-- ============================================================================
-- Self-service de foto de perfil.
--
-- Requerimiento de dirección: cada usuario (admin, rh, psicologa, empleado)
-- puede ponerse y quitarse SU PROPIA foto desde la nueva sección "Mi perfil".
--
-- Antes solo admin/psicologa podían tocar avatares (mig 021), y solo admin/rh
-- podían hacer UPDATE en public.usuarios (mig 016/023) — así que un empleado o
-- la psicologa no podían guardar su propia foto. Esta migración es ADITIVA: suma
-- permisos acotados al recurso propio, sin quitar los existentes (las policies
-- permisivas se combinan por OR), por lo que el flujo de Expedientes no cambia.
--
-- Path del archivo: avatars/<usuario_id>.jpg (ver avatarService.js). El helper
-- public.current_usuario_id() (mig 015) da el id de la fila del caller.
-- ============================================================================

-- 1) STORAGE: cada usuario gestiona únicamente su propio archivo avatars/<id>.jpg
create policy avatars_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and name = public.current_usuario_id()::text || '.jpg'
  );

create policy avatars_update_own
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and name = public.current_usuario_id()::text || '.jpg'
  );

create policy avatars_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and name = public.current_usuario_id()::text || '.jpg'
  );

-- 2) USUARIOS: permitir a cada usuario UPDATE de su propia fila (para guardar
--    avatar_url). La restricción de columnas se hace en el trigger de abajo.
create policy usuarios_update_own
  on public.usuarios for update
  using (id = public.current_usuario_id())
  with check (id = public.current_usuario_id());

-- 3) Acotar el self-update a SOLO avatar_url. Se amplía la función del trigger
--    anti-escalación (mig 023, el trigger ya está creado — solo se reemplaza la
--    función): un caller que NO es admin ni rh, editando su propia fila, solo
--    puede cambiar avatar_url. Evita que un empleado se auto-edite
--    username / inactivo / debe_cambiar_password / etc. vía la policy de arriba.
create or replace function public.prevent_usuario_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Guarda original: solo admin puede tocar role / auth_user_id.
  if public.current_role() is distinct from 'admin' then
    if new.role is distinct from old.role then
      raise exception 'No autorizado: solo un administrador puede cambiar el rol de un usuario.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No autorizado: solo un administrador puede cambiar el vínculo de autenticación.';
    end if;
  end if;

  -- Self-service acotado: un caller que no es admin ni rh, sobre su propia fila,
  -- solo puede modificar avatar_url. Se comparan todas las columnas salvo
  -- avatar_url y updated_at (esta última la fija el trigger trg_usuarios_updated_at).
  if public.current_role() not in ('admin', 'rh')
     and new.id = public.current_usuario_id() then
    if (to_jsonb(new) - 'avatar_url' - 'updated_at')
       is distinct from (to_jsonb(old) - 'avatar_url' - 'updated_at') then
      raise exception 'No autorizado: solo puedes cambiar tu foto de perfil.';
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Verificación manual (como empleado autenticado, tras el deploy):
--   update public.usuarios set avatar_url = 'x' where id = public.current_usuario_id();
--     -> OK.
--   update public.usuarios set username = 'hack' where id = public.current_usuario_id();
--     -> debe fallar: "solo puedes cambiar tu foto de perfil".
--   update public.usuarios set inactivo = false where id = <otro_empleado>;
--     -> 0 filas (la policy usuarios_update_own no aplica a filas ajenas).
-- ----------------------------------------------------------------------------
