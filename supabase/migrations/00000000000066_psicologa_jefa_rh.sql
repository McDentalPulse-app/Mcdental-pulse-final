-- Psicóloga = jefa de RH: tiene TODO lo de RH (aprobar permisos/vacaciones) + lo suyo (reportes
-- confidenciales). RH NO tiene lo de la psicóloga.
--
-- Dos cosas:
--   1. Acceso: RH deja de VER los reportes confidenciales (solo admin y psicóloga). El panel se
--      quita del layout/menú de RH aparte; esto es el candado de verdad (RLS), sin el cual RH
--      podría seguir consultándolos por la API.
--   2. Notificaciones (triggers, bandeja): a gestión le llega una notificación cuando hay algo que
--      atender. Como el aviso, son triggers y no endpoints (las solicitudes se insertan desde el
--      cliente) y por eso NO mandan push al teléfono —un trigger no firma VAPID—, solo dejan la
--      fila en la campana.

-- ---------------------------------------------------------------------------
-- 1. RH pierde la lectura de reportes confidenciales.
-- ---------------------------------------------------------------------------
drop policy if exists reportes_confidenciales_select_gestion on public.reportes_confidenciales;
create policy reportes_confidenciales_select_gestion on public.reportes_confidenciales
  for select using ((select public.current_role()) in ('admin', 'psicologa'));

-- ---------------------------------------------------------------------------
-- 2a. Solicitud de permiso -> avisa a RH + admin + psicóloga.
-- ---------------------------------------------------------------------------
create or replace function public.notificar_permiso_solicitado()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_nombre text;
begin
  -- Solo solicitudes REALES de empleados (pendiente + origen empleado). Las correcciones que mete
  -- gestión (justificar falta: aprobado + origen rh, migración 061) no deben notificar a nadie.
  if new.estado <> 'pendiente' or coalesce(new.origen::text, '') <> 'empleado' then
    return new;
  end if;
  select name into v_nombre from public.usuarios where id = new.empleado_id;
  insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
  select u.id, 'permiso', 'Nueva solicitud de permiso',
         coalesce(v_nombre, 'Un empleado') || ' solicitó un permiso.',
         case u.role when 'rh' then '/rh/permisos' when 'psicologa' then '/psicologa/permisos' else '/admin' end
  from public.usuarios u
  where coalesce(u.inactivo, false) = false and u.role in ('rh', 'admin', 'psicologa');
  return new;
end;
$function$;
drop trigger if exists permisos_notifican on public.permisos;
create trigger permisos_notifican after insert on public.permisos
  for each row execute function public.notificar_permiso_solicitado();

-- ---------------------------------------------------------------------------
-- 2b. Solicitud de vacaciones -> avisa a RH + admin + psicóloga.
-- ---------------------------------------------------------------------------
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
  where coalesce(u.inactivo, false) = false and u.role in ('rh', 'admin', 'psicologa');
  return new;
end;
$function$;
drop trigger if exists vacaciones_notifican on public.vacaciones;
create trigger vacaciones_notifican after insert on public.vacaciones
  for each row execute function public.notificar_vacacion_solicitada();

-- ---------------------------------------------------------------------------
-- 2c. Reporte confidencial -> avisa a psicóloga + admin (NO a RH). Sin nombre en el cuerpo:
--     es confidencial; el detalle se ve en el panel.
-- ---------------------------------------------------------------------------
create or replace function public.notificar_reporte_confidencial()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
  select u.id, 'confidencial', 'Nuevo reporte confidencial',
         'Se recibió un reporte confidencial' || coalesce(' (' || new.urgencia || ')', '') || '.',
         case u.role when 'psicologa' then '/psicologa/confidenciales' else '/admin/confidenciales' end
  from public.usuarios u
  where coalesce(u.inactivo, false) = false and u.role in ('psicologa', 'admin');
  return new;
end;
$function$;
drop trigger if exists reportes_confidenciales_notifican on public.reportes_confidenciales;
create trigger reportes_confidenciales_notifican after insert on public.reportes_confidenciales
  for each row execute function public.notificar_reporte_confidencial();
