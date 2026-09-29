-- ============================================================================
-- 178 — Los teléfonos con la app nativa a los que se les puede mandar un push.
--
-- La web usa Web Push (push_suscripciones, migración 049), que no llega a una app nativa. Android
-- recibe por Firebase Cloud Messaging, con un TOKEN por instalación. Esta tabla es el gemelo de
-- push_suscripciones para esos tokens, y api/_push.js manda por los dos caminos a la vez: toda
-- notificación que ya le llega a alguien en la web le llega igual en la app.
--
-- SE ESCRIBE SOLO POR RPC, no con INSERT directo, por el caso del teléfono compartido: en
-- recepción, si Ana cierra sesión y entra Luis, el MISMO token tiene que pasar a Luis. Con un
-- INSERT bajo RLS, el token seguiría siendo de Ana (Luis no puede tocar una fila ajena) y a Luis
-- le llegarían los avisos de Ana. `registrar_token_fcm` lo reasigna en una sola sentencia.
-- ============================================================================

begin;

create table if not exists public.push_fcm (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.usuarios(id) on delete cascade,
  -- Único: un token es UNA instalación. Si vuelve a registrarse, se actualiza su fila.
  token       text not null unique,
  creado_en   timestamptz not null default now(),
  ultimo_uso  timestamptz not null default now()
);

create index if not exists push_fcm_empleado_idx on public.push_fcm (empleado_id);

comment on table public.push_fcm is
  'Tokens de Firebase Cloud Messaging de la app nativa. Solo se escribe por registrar_token_fcm/borrar_token_fcm; lo lee el servidor (service_role) para enviar. Migración 178.';

-- RLS encendida y SIN políticas para authenticated: nadie lee ni escribe la tabla directamente.
-- Un token es lo que permite mandarle notificaciones a un teléfono; no tiene por qué verlo nadie.
alter table public.push_fcm enable row level security;
revoke all on public.push_fcm from anon, authenticated;
grant select, insert, update, delete on public.push_fcm to service_role;

create or replace function public.registrar_token_fcm(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := public.current_usuario_id();
begin
  if v_yo is null then
    raise exception 'No autenticado.';
  end if;
  -- Un token de FCM mide unos 160 caracteres. El tope evita que alguien llene la tabla de basura.
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'Token inválido.';
  end if;

  insert into public.push_fcm (empleado_id, token)
  values (v_yo, p_token)
  on conflict (token) do update
     set empleado_id = excluded.empleado_id,
         ultimo_uso  = now();
end;
$$;

-- Al cerrar sesión: ese teléfono deja de recibir lo de esta persona. Solo borra el propio.
create or replace function public.borrar_token_fcm(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_fcm
   where token = p_token
     and empleado_id = public.current_usuario_id();
$$;

revoke all on function public.registrar_token_fcm(text) from public, anon;
revoke all on function public.borrar_token_fcm(text) from public, anon;
grant execute on function public.registrar_token_fcm(text) to authenticated;
grant execute on function public.borrar_token_fcm(text) to authenticated;

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   · Como anon: select public.registrar_token_fcm('x...') -> permission denied.
--   · Como empleado: registrar un token, y que `select * from push_fcm` le dé permission denied.
--   · El mismo token registrado por otra persona pasa a ser suyo (una fila, otro empleado_id).
--
-- ROLLBACK:
--   drop function if exists public.registrar_token_fcm(text);
--   drop function if exists public.borrar_token_fcm(text);
--   drop table if exists public.push_fcm;
-- ----------------------------------------------------------------------------
