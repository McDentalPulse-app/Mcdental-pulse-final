-- ============================================================================
-- Cierra la escalación de privilegios rh -> admin.
--
-- Problema: la policy `usuarios_update_admin_rh` (migración 016) daba UPDATE a
-- cualquier rol 'admin' o 'rh' sin WITH CHECK ni restricción de columnas. Un
-- usuario 'rh' podía ejecutar directamente vía supabase-js:
--     update public.usuarios set role = 'admin' where id = <su_propio_id>;
-- y auto-otorgarse rol admin, obteniendo acceso a notas_psicologicas y
-- reportes_confidenciales (el activo más sensible del sistema).
--
-- Fix: RLS en Postgres no restringe columnas, así que además de un WITH CHECK
-- simétrico se agrega un trigger BEFORE UPDATE que impide a cualquier caller
-- que NO sea admin cambiar `role` o `auth_user_id`. RH conserva la edición de
-- campos operativos (puesto, sucursal, teléfono, etc.) sin cambios en la app.
-- ============================================================================

-- Simetría defensiva: el rol que edita debe seguir siendo admin/rh tras el update.
drop policy if exists usuarios_update_admin_rh on public.usuarios;

create policy usuarios_update_admin_rh
  on public.usuarios for update
  using (public.current_role() in ('admin', 'rh'))
  with check (public.current_role() in ('admin', 'rh'));

-- Guarda real a nivel de columna: solo admin puede tocar role/auth_user_id.
create or replace function public.prevent_usuario_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.current_role() is distinct from 'admin' then
    if new.role is distinct from old.role then
      raise exception 'No autorizado: solo un administrador puede cambiar el rol de un usuario.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No autorizado: solo un administrador puede cambiar el vínculo de autenticación.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_usuarios_prevent_privilege_escalation on public.usuarios;

create trigger trg_usuarios_prevent_privilege_escalation
  before update on public.usuarios
  for each row
  execute function public.prevent_usuario_privilege_escalation();

-- ----------------------------------------------------------------------------
-- Verificación manual (ejecutar como usuario 'rh' autenticado tras el deploy):
--   update public.usuarios set role = 'admin' where id = public.current_usuario_id();
--   -> debe fallar con "solo un administrador puede cambiar el rol".
--   update public.usuarios set puesto = 'Recepcionista' where id = <otro_empleado>;
--   -> debe seguir funcionando.
-- ----------------------------------------------------------------------------
