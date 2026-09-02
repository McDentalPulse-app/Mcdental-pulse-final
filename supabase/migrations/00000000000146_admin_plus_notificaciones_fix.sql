-- ============================================================================
-- Admin+ en las 3 notificaciones de la migración 066 — mismo motivo que la 145:
-- `u.role in ('rh', 'admin', 'psicologa')` es un chequeo directo de columna, no
-- pasa por current_role(), así que el pliegue de la migración 139 no lo cubre.
-- Sin esto, admin_plus nunca recibe la campanita de "nueva solicitud de permiso/
-- vacaciones" ni "nuevo reporte confidencial" — algo que admin sí tiene.
-- Hallazgo de la tercera ronda de revisión de esta feature.
--
-- No se edita 066 en su lugar: ya corrió contra la VPS. Se redefinen las mismas
-- 3 funciones con CREATE OR REPLACE, mismo cuerpo, un solo cambio por función.
-- ============================================================================

create or replace function public.notificar_permiso_solicitado()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_nombre text;
begin
  if new.estado <> 'pendiente' or coalesce(new.origen::text, '') <> 'empleado' then
    return new;
  end if;
  select name into v_nombre from public.usuarios where id = new.empleado_id;
  insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
  select u.id, 'permiso', 'Nueva solicitud de permiso',
         coalesce(v_nombre, 'Un empleado') || ' solicitó un permiso.',
         case u.role when 'rh' then '/rh/permisos' when 'psicologa' then '/psicologa/permisos' else '/admin' end
  from public.usuarios u
  where coalesce(u.inactivo, false) = false and u.role in ('rh', 'admin', 'admin_plus', 'psicologa');
  return new;
end;
$function$;

create or replace function public.notificar_vacacion_solicitada()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_nombre text;
begin
  if new.estado <> 'pendiente' or coalesce(new.origen::text, '') <> 'empleado' then
    return new;
  end if;
  select name into v_nombre from public.usuarios where id = new.empleado_id;
  insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
  select u.id, 'vacacion', 'Nueva solicitud de vacaciones',
         coalesce(v_nombre, 'Un empleado') || ' solicitó vacaciones.',
         case u.role when 'rh' then '/rh/vacaciones' when 'psicologa' then '/psicologa/vacaciones' else '/admin' end
  from public.usuarios u
  where coalesce(u.inactivo, false) = false and u.role in ('rh', 'admin', 'admin_plus', 'psicologa');
  return new;
end;
$function$;

create or replace function public.notificar_reporte_confidencial()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
  select u.id, 'confidencial', 'Nuevo reporte confidencial',
         'Se recibió un reporte confidencial' || coalesce(' (' || new.urgencia || ')', '') || '.',
         case u.role when 'psicologa' then '/psicologa/confidenciales' else '/admin/confidenciales' end
  from public.usuarios u
  where coalesce(u.inactivo, false) = false and u.role in ('psicologa', 'admin', 'admin_plus');
  return new;
end;
$function$;
