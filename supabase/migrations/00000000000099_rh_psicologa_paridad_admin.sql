-- rh y psicologa pasan a tener las mismas capacidades que admin sobre `usuarios`.
--
-- DECISION DELIBERADA DEL DUEÑO DEL SISTEMA (2026-07-30), tomada con las consecuencias
-- sobre la mesa. Se documenta aquí porque dentro de un año esto va a parecer un descuido
-- y no lo fue.
--
-- QUE SE ABRE
--   Hasta ahora `prevent_usuario_privilege_escalation` reservaba a 'admin' dos cosas:
--   cambiar `role` y cambiar `auth_user_id`. Esa era la única barrera entre "gestionar
--   personal" y "controlar el sistema". A partir de aquí rh y psicologa también pueden.
--
-- QUE SIGNIFICA EN LA PRACTICA
--   · Una cuenta rh o psicologa puede promoverse a sí misma a 'admin'.
--   · Puede promover o degradar a cualquiera, incluido un admin existente.
--   · Puede reasignar `auth_user_id`, es decir, apuntar una ficha a otra credencial.
--   Por tanto: comprometer la cuenta de RH o la de la psicologa equivale a comprometer
--   el sistema entero. No queda ningún control que lo impida desde la base de datos.
--
-- QUE NO CAMBIA
--   La guarda de autoservicio sigue existiendo para 'empleado' y 'doctor': sobre su
--   propia fila solo pueden tocar avatar_url y banner_url. Se añade psicologa a la lista
--   de exentos para dejarla en igualdad con rh, que ya lo estaba.
--
-- COMO SE REVIERTE
--   Volver a poner 'admin' en las dos comparaciones de abajo. No hay datos que migrar:
--   el trigger es la única pieza, y actúa BEFORE UPDATE con independencia de RLS.

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

-- La policy de INSERT de `usuarios` tenía ('admin','rh') y dejaba fuera a psicologa.
-- En la práctica el alta pasa por la edge function admin-create-usuario (service_role,
-- bypassa RLS), así que esto es por coherencia: que la tabla diga lo mismo que el código.
drop policy if exists usuarios_insert_admin_rh on public.usuarios;

create policy usuarios_insert_gestion
  on public.usuarios for insert
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));
