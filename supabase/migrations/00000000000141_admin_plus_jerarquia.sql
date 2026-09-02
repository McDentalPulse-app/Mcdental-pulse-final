-- ============================================================================
-- Rol 'admin_plus' (parte 3/3): jerarquía admin/admin_plus + cierra el hueco
-- de seguridad abierto por la migración 099.
--
-- QUE ABRIÓ LA 099 (2026-07-30, decisión del dueño en su momento): rh y psicologa
-- pueden cambiar `role`/`auth_user_id` de CUALQUIER fila, incluida una que ya es
-- 'admin' — comprometer rh o psicologa hoy equivale a comprometer el sistema entero.
-- El fix de esto (documentado en plan-cerrar-hallazgos-pentest.md, migración 119)
-- se aplicó solo en la VPS y nunca volvió a este repo — 113 a 119 no existen aquí.
--
-- QUE HACE ESTA MIGRACIÓN:
--   1. Restaura esa protección: quien no es admin_plus (rol_real(), sin plegar) no
--      puede tocar `role`/`auth_user_id` de una fila que HOY es 'admin' o
--      'admin_plus', ni ascender a nadie a esos dos roles.
--   2. El primer admin_plus se crea reclamando el ticket de arranque (mig. 140):
--      atómico y solo para quien YA es 'admin' de verdad — no cualquiera de
--      gestión, y no hay ventana de carrera.
--   3. Admin (no admin_plus) sigue gestionando rh/psicologa/doctor/empleado entre
--      sí exactamente igual que hoy — sin regresión ahí.
--   4. Los 6 interruptores de módulo nuevos (mig. 142: puede_ver_comisiones y
--      compañía) quedan reservados a admin_plus, sobre CUALQUIER fila — a
--      diferencia de los 6 interruptores viejos (bodega/inventario/...), que
--      admin/rh/psicologa siguen editando igual que hoy (fuera de alcance de
--      esta feature). Sin esto, cualquier rh/psicologa podía apagarle Checador
--      o Encuestas a alguien con un PATCH directo, saltándose ModulosPanel.jsx
--      por completo — hallazgo de la revisión de seguridad de esta feature.
--
-- Este trigger es BEFORE UPDATE únicamente (mig. 023) — no cubre INSERT ni DELETE.
-- La misma regla de jerarquía (sin la de módulos, que no aplica a creación) se
-- replica en los Edge Functions admin-create-usuario / admin-delete-usuario /
-- admin-reset-password / admin-update-username, que sí cubren esos caminos.
-- ============================================================================

create or replace function public.prevent_usuario_privilege_escalation()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_toca_admin boolean;
begin
  -- Gestión (admin/rh/psicologa; admin_plus cuenta como admin vía current_role())
  -- puede cambiar role/auth_user_id de rh/psicologa/doctor/empleado entre sí, igual
  -- que hoy. Nadie fuera de gestión puede tocar ninguno de los dos campos.
  if public.current_role() not in ('admin', 'rh', 'psicologa') then
    if new.role is distinct from old.role then
      raise exception 'No autorizado: solo gestión puede cambiar el rol de un usuario.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No autorizado: solo gestión puede cambiar el vínculo de autenticación.';
    end if;
  end if;

  -- Jerarquía: tocar una fila que ES o VA A SER admin/admin_plus está reservado a
  -- admin_plus real (rol_real(), no plegado) — ni siquiera un admin normal puede.
  if (new.role is distinct from old.role) or (new.auth_user_id is distinct from old.auth_user_id) then
    v_toca_admin := old.role in ('admin', 'admin_plus') or new.role in ('admin', 'admin_plus');

    if v_toca_admin and public.rol_real() is distinct from 'admin_plus' then
      -- Excepción de arranque: reclamar el ticket de un solo uso (mig. 140) — ya
      -- comprueba ahí adentro que quien llama es 'admin' de verdad, y es atómico.
      if not (new.role = 'admin_plus' and old.role not in ('admin', 'admin_plus')
              and public.reclamar_bootstrap_admin_plus()) then
        raise exception 'No autorizado: solo Admin+ puede tocar una cuenta admin o admin_plus.';
      end if;
    end if;
  end if;

  -- Módulos (mig. 142): los 6 interruptores nuevos son admin_plus-only sobre
  -- CUALQUIER fila, incluida la propia — nadie se los prende/apaga a sí mismo.
  if public.rol_real() is distinct from 'admin_plus' and (
       new.puede_ver_comisiones is distinct from old.puede_ver_comisiones
    or new.puede_usar_checador is distinct from old.puede_usar_checador
    or new.puede_usar_notas is distinct from old.puede_usar_notas
    or new.puede_ver_departamentos is distinct from old.puede_ver_departamentos
    or new.puede_ver_avisos is distinct from old.puede_ver_avisos
    or new.puede_ver_encuestas is distinct from old.puede_ver_encuestas
  ) then
    raise exception 'No autorizado: los módulos solo los cambia Admin+.';
  end if;

  -- Self-service acotado a avatar_url y banner_url para quien NO es gestión, sobre su
  -- propia fila, EXCEPTO cuando una RPC legítima marca su señal local a la transacción
  -- (sin cambios respecto a la migración 099).
  if public.current_role() not in ('admin', 'rh', 'psicologa')
     and new.id = public.current_usuario_id()
     and coalesce(current_setting('app.marking_password_changed', true), 'off') <> 'on'
     and coalesce(current_setting('app.setting_color_acento', true), 'off') <> 'on' then
    if (to_jsonb(new) - 'avatar_url' - 'banner_url' - 'updated_at')
       is distinct from (to_jsonb(old) - 'avatar_url' - 'banner_url' - 'updated_at') then
      raise exception 'No autorizado: solo puedes cambiar tu foto de perfil y tu portada.';
    end if;
  end if;

  return new;
end;
$function$;
