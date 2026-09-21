-- Solo un admin puede crear, otorgar o quitar el rol de admin.
--
-- EL PROBLEMA (pentest 2026-08-07): con la paridad rh/psicologa = admin (migración 099), un RH
-- podía ascender a cualquiera a admin con un simple PATCH a usuarios.role — verificado, HTTP 204.
-- Y como un admin SÍ puede borrar, eso esquivaba la restricción de "solo admin borra" (la edge
-- function admin-delete-usuario) en dos pasos: RH asciende un títere a admin, entra con él, borra.
-- Una cuenta de RH comprometida, además, podía fabricar admins a voluntad.
--
-- Decisión del dueño: RH y psicóloga siguen gestionando a TODO el personal (empleado, doctor, rh,
-- psicóloga entre sí) — esa paridad se queda —, pero el rol `admin` queda reservado. Solo un admin
-- crea, otorga o degrada a otro admin.
--
-- Este trigger cubre el camino UPDATE (el PATCH directo). El camino de CREACIÓN (INSERT vía la
-- edge function admin-create-usuario) NO pasa por aquí —el trigger es BEFORE UPDATE— y se cierra
-- por separado en esa función, con la misma regla.

create or replace function public.prevent_usuario_privilege_escalation()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Antes: solo 'admin'. Ahora los tres roles de gestión (ver cabecera de la migración).
  if public.current_role() not in ('admin', 'rh', 'psicologa') then
    if new.role is distinct from old.role then
      raise exception 'No autorizado: solo gestión puede cambiar el rol de un usuario.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No autorizado: solo gestión puede cambiar el vínculo de autenticación.';
    end if;
  end if;

  -- El rol `admin` es aparte de la paridad. Solo se comprueba para rh/psicologa REALES: para un
  -- admin current_role() es 'admin' (no entra, puede todo) y para service_role es NULL (las edge
  -- functions legítimas no se tocan; el veto a crear admins desde una vive en admin-create-usuario).
  if public.current_role() in ('rh', 'psicologa') then
    if new.role = 'admin' and old.role is distinct from 'admin' then
      raise exception 'No autorizado: solo un administrador puede otorgar el rol de administrador.';
    end if;
    if old.role = 'admin' and new.role is distinct from 'admin' then
      raise exception 'No autorizado: solo un administrador puede cambiar el rol de un administrador.';
    end if;
  end if;

  -- Self-service acotado a avatar_url y banner_url para quien NO es gestión, sobre su
  -- propia fila, EXCEPTO cuando una RPC legítima marca su señal local a la transacción:
  --   · app.marking_password_changed = 'on'  (mark_password_changed, mig 027)
  --   · app.setting_color_acento    = 'on'  (guardar_mi_color, mig 070)
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

-- Rollback: volver a aplicar el cuerpo de esta función sin el bloque de rh/psicologa (es como
-- estaba justo antes de esta migración). El trigger trg_usuarios_prevent_privilege_escalation no
-- se toca: sigue apuntando a esta misma función.
