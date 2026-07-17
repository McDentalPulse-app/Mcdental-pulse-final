-- Al publicarse un aviso (comunicado), notifica a toda la plantilla activa en su campana.
--
-- Por qué un TRIGGER y no un endpoint:
--   1. El aviso se crea con un insert directo desde el cliente (avisosService.addAviso), así que
--      un trigger lo capta SIEMPRE, sin cablear nada en el cliente ni confiar en que llame a un
--      endpoint después.
--   2. Vercel Hobby topa en 12 funciones y ya estábamos justo en el límite: un endpoint nuevo
--      habría tumbado el deploy.
--
-- Deja la fila en la bandeja (campana + realtime badge en vivo). El push-al-teléfono para avisos
-- queda FUERA: un trigger de Postgres no puede firmar el envío VAPID (esa clave vive en el
-- servidor de Vercel). El modal bloqueante que ya existe + el badge en vivo cubren el aviso
-- dentro de la app; sumar el push exige una función dedicada (Pro, o liberar un slot).

create or replace function public.notificar_aviso_nuevo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Una fila por persona de la plantilla activa, menos el autor: quien publica el aviso no
  -- necesita que le avisen de su propio aviso.
  insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
  select u.id, 'aviso', 'Nuevo aviso: ' || new.titulo, left(coalesce(new.cuerpo, ''), 120), '/'
  from public.usuarios u
  where coalesce(u.inactivo, false) = false
    and u.id <> new.creado_por;
  return new;
end;
$function$;

create trigger avisos_notifican
  after insert on public.avisos
  for each row execute function public.notificar_aviso_nuevo();
