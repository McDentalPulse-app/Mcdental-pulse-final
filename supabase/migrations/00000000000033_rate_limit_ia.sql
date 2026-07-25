-- ============================================================================
-- Rate limiting del proxy de IA (hallazgo M4).
--
-- api/gemini.js exige un JWT válido, pero no limita cuántas veces puede llamarlo un
-- mismo usuario. Un empleado autenticado podía quemar la cuota de Gemini en un bucle
-- —con el coste que eso implica— y dejar la función de IA inservible para el resto.
--
-- El proxy corre en Vercel (serverless): no tiene memoria entre invocaciones, así que
-- el contador tiene que vivir en la base.
--
-- Se resuelve con una RPC `security definer` en vez de dar acceso directo a la tabla:
-- el cliente no puede leer ni escribir el contador, solo pedir permiso. La RPC hace la
-- comprobación y el registro EN LA MISMA transacción, así que no hay hueco entre
-- "consultar" y "consumir".
-- ============================================================================

create table if not exists public.ia_uso (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  creado_en   timestamptz not null default now()
);

-- La consulta siempre es "cuántas veces ha llamado ESTE usuario desde ESTE momento".
create index if not exists idx_ia_uso_usuario_creado
  on public.ia_uso (usuario_id, creado_en desc);

alter table public.ia_uso enable row level security;

-- Sin policies A PROPÓSITO: nadie accede a la tabla directamente. El único camino es la
-- RPC de abajo, que es security definer. Así un usuario no puede borrar su propio
-- contador para saltarse el límite.
revoke all on public.ia_uso from anon, authenticated;

comment on table public.ia_uso is
  'Contador de llamadas al proxy de IA, por usuario. Solo accesible vía consumir_cuota_ia(). Ver migración 033.';


/**
 * Pide permiso para hacer una llamada a la IA. Devuelve si se permite, cuántas lleva y
 * cuál es el límite — para poder darle al usuario un mensaje útil, no un 429 pelado.
 *
 * Comprobar y registrar van en la misma transacción, con un advisory lock por usuario:
 * sin él, dos peticiones simultáneas podrían leer ambas "29 de 30" y colarse las dos.
 */
create or replace function public.consumir_cuota_ia(
  p_limite  integer  default 30,
  p_ventana interval default '1 hour'
)
returns table (permitido boolean, usadas integer, limite integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_usadas  integer;
begin
  v_usuario := public.current_usuario_id();
  if v_usuario is null then
    raise exception 'No autenticado.';
  end if;

  -- Serializa las llamadas de ESTE usuario dentro de la transacción. No bloquea a nadie más.
  perform pg_advisory_xact_lock(hashtext(v_usuario::text));

  -- Purga barata: el contador solo necesita la ventana reciente. Evita que la tabla crezca
  -- sin fin sin montar un cron para ello.
  delete from public.ia_uso where creado_en < now() - interval '24 hours';

  select count(*) into v_usadas
  from public.ia_uso
  where usuario_id = v_usuario
    and creado_en > now() - p_ventana;

  if v_usadas >= p_limite then
    return query select false, v_usadas, p_limite;
    return;
  end if;

  insert into public.ia_uso (usuario_id) values (v_usuario);

  return query select true, v_usadas + 1, p_limite;
end;
$$;

revoke all on function public.consumir_cuota_ia(integer, interval) from public, anon;
grant execute on function public.consumir_cuota_ia(integer, interval) to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (autenticado como cualquier usuario):
--
--   select * from public.consumir_cuota_ia(2, '1 hour');  -> permitido=true,  usadas=1
--   select * from public.consumir_cuota_ia(2, '1 hour');  -> permitido=true,  usadas=2
--   select * from public.consumir_cuota_ia(2, '1 hour');  -> permitido=FALSE, usadas=2
--
--   select * from public.ia_uso;  -> debe FALLAR (permission denied): la tabla no es accesible.
--
-- ROLLBACK:
--   drop function if exists public.consumir_cuota_ia(integer, interval);
--   drop table if exists public.ia_uso;
-- ----------------------------------------------------------------------------
