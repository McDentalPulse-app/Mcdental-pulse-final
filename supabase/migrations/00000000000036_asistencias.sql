-- ============================================================================
-- Checador: registro de entradas y salidas con comprobación de foto y ubicación.
--
-- LA REGLA QUE SOSTIENE TODO EL MÓDULO: la hora y la distancia las decide el
-- servidor, nunca el navegador.
--
-- Si el cliente pudiera mandar `marcada_en`, cualquiera atrasa el reloj de su
-- teléfono y llega puntual todos los días. Si el cliente pudiera mandar
-- `ubicacion_estado`, cualquiera manda 'dentro' desde su casa con un fetch. Por eso
-- la tabla NO tiene policy de INSERT para el rol empleado: el único camino de
-- escritura es la RPC registrar_checada(), que es security definer, toma la hora de
-- now() y calcula la distancia en SQL. El cliente solo aporta lat/lng crudos y el
-- path de la selfie. Mismo patrón (y misma razón) que consumir_cuota_ia() en la
-- migración 033.
--
-- Lo que esta tabla NO guarda: si el día fue falta, retardo o justificado. Eso es
-- DERIVADO (checadas + horario + permisos aprobados) y se calcula en
-- src/utils/asistencia.js. Si se almacenara, aprobar un permiso el jueves para el
-- lunes pasado obligaría a reescribir filas viejas — y el día que ese recálculo
-- fallara, el reporte mentiría en silencio. Derivarlo hace que la corrección sea
-- automática y que la lógica sea testeable sin base de datos.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_checada') then
    create type public.tipo_checada as enum ('entrada', 'salida');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_ubicacion') then
    -- dentro/fuera: hubo GPS y hubo geocerca, se pudo comparar.
    -- sin_gps: el empleado no dio permiso de ubicación o el GPS expiró.
    -- sin_geocerca: su clínica todavía no tiene coordenadas capturadas (migración 034).
    -- Los dos últimos NO son un error ni bloquean la checada: son un "no se pudo
    -- comprobar", y RH los ve señalados para revisarlos.
    create type public.estado_ubicacion as enum ('dentro', 'fuera', 'sin_gps', 'sin_geocerca');
  end if;
end $$;

create table if not exists public.asistencias (
  id               uuid primary key default gen_random_uuid(),
  empleado_id      uuid not null references public.usuarios(id) on delete cascade,
  tipo             public.tipo_checada not null,

  -- fecha y marcada_en las pone SIEMPRE el servidor (ver la RPC). No tienen default
  -- a propósito: un default invitaría a insertarlas desde fuera.
  fecha            date not null,
  marcada_en       timestamptz not null,

  lat              numeric(9, 6),
  lng              numeric(9, 6),
  precision_m      integer,           -- accuracy que reporta el GPS del móvil, en metros
  sucursal_id      uuid references public.sucursales(id),
  distancia_m      integer,           -- calculada en SQL por la RPC, no en JS
  ubicacion_estado public.estado_ubicacion not null,

  selfie_path      text,              -- path DENTRO del bucket, no una URL (igual que archivos_expediente)

  origen           public.origen_solicitud not null default 'empleado',  -- 'rh' = alta manual
  anulada          boolean not null default false,
  nota_rh          text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.asistencias is
  'Checadas de entrada/salida. Escritura del empleado SOLO vía public.registrar_checada() (security definer): la hora y la distancia las fija el servidor. El estado del día (falta/retardo/justificado) NO se guarda, se deriva en src/utils/asistencia.js. Ver migración 036.';
comment on column public.asistencias.fecha is
  'Día natural en America/Monterrey, NO en UTC. now() en Supabase es UTC: una salida a las 19:00 de Tamaulipas cae en el día SIGUIENTE en UTC, y el reporte diario saldría corrido. La RPC lo fija con (now() at time zone TZ)::date.';
comment on column public.asistencias.anulada is
  'RH marca así una checada errónea. No se borra: el registro de asistencia es un documento laboral y su historial importa. Ver nota_rh para el motivo.';

create index if not exists idx_asistencias_empleado_fecha
  on public.asistencias (empleado_id, fecha desc);
create index if not exists idx_asistencias_fecha
  on public.asistencias (fecha desc);

drop trigger if exists trg_asistencias_updated_at on public.asistencias;
create trigger trg_asistencias_updated_at
  before update on public.asistencias
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- Distancia entre dos puntos, en metros (haversine).
--
-- A mano y no con earthdistance/postgis a propósito: la única extensión instalada
-- en este proyecto es pgcrypto (migración 001), y añadir una extensión al esquema
-- por una sola fórmula de cinco líneas no lo vale. La Tierra no es una esfera
-- perfecta, pero a escala de "¿estás a 80 m o a 3 km de tu clínica?" el error del
-- modelo esférico (~0,5%) es un orden de magnitud menor que el error del propio GPS
-- de un móvil en interiores (10-50 m).
-- ----------------------------------------------------------------------------
create or replace function public.distancia_metros(
  p_lat1 numeric, p_lng1 numeric,
  p_lat2 numeric, p_lng2 numeric
)
returns integer
language sql
immutable
as $$
  select round(
    6371000 * 2 * asin(
      sqrt(
        power(sin(radians((p_lat2 - p_lat1)::double precision) / 2), 2)
        + cos(radians(p_lat1::double precision)) * cos(radians(p_lat2::double precision))
        * power(sin(radians((p_lng2 - p_lng1)::double precision) / 2), 2)
      )
    )
  )::integer;
$$;

comment on function public.distancia_metros is
  'Haversine, radio terrestre 6.371 km. Devuelve metros redondeados.';


-- ----------------------------------------------------------------------------
-- registrar_checada(): el ÚNICO camino por el que un empleado escribe una checada.
--
-- security definer + sin policy de INSERT para empleado = no hay forma de inyectar
-- una checada con hora o coordenada falsas por PostgREST.
-- ----------------------------------------------------------------------------
create or replace function public.registrar_checada(
  p_tipo        public.tipo_checada,
  p_lat         numeric default null,
  p_lng         numeric default null,
  p_precision   integer default null,
  p_selfie_path text    default null
)
returns public.asistencias
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Zona horaria de la operación. Todas las clínicas están en el centro/noreste de
  -- México; si algún día abre una en otro huso, esto pasa a ser una columna de
  -- sucursales en vez de una constante.
  c_tz constant text := 'America/Monterrey';

  v_usuario       uuid;
  v_sucursal      public.sucursales%rowtype;
  v_nombre_suc    text;
  v_fecha         date;
  v_distancia     integer;
  v_estado        public.estado_ubicacion;
  v_ultima        public.asistencias%rowtype;
  v_tiene_entrada boolean;
  v_fila          public.asistencias%rowtype;
begin
  v_usuario := public.current_usuario_id();
  if v_usuario is null then
    raise exception 'No autenticado.';
  end if;

  -- Serializa las checadas de ESTE usuario dentro de la transacción. Sin esto, un
  -- doble toque en el botón (o un móvil con red lenta que reintenta) puede meter dos
  -- entradas simultáneas: ambas leerían "no hay checada reciente" antes de que la
  -- otra insertara. No bloquea a nadie más.
  perform pg_advisory_xact_lock(hashtext('checada:' || v_usuario::text));

  v_fecha := (now() at time zone c_tz)::date;

  -- Anti doble-clic: misma checada, mismo tipo, hace menos de 90 s.
  select * into v_ultima
  from public.asistencias
  where empleado_id = v_usuario
    and tipo = p_tipo
    and anulada = false
  order by marcada_en desc
  limit 1;

  if found and v_ultima.marcada_en > now() - interval '90 seconds' then
    raise exception 'Ya registraste tu % hace unos segundos.', p_tipo;
  end if;

  -- Una salida sin entrada ese día es un dato imposible: bloquearla aquí evita que
  -- el historial tenga días que no se pueden emparejar ni interpretar.
  if p_tipo = 'salida' then
    select exists (
      select 1 from public.asistencias
      where empleado_id = v_usuario
        and fecha = v_fecha
        and tipo = 'entrada'
        and anulada = false
    ) into v_tiene_entrada;

    if not v_tiene_entrada then
      raise exception 'No puedes registrar tu salida: hoy no tienes una entrada registrada.';
    end if;
  end if;

  -- Geocerca. usuarios.sucursal es texto libre; si no casa con ninguna fila de
  -- sucursales (o la clínica aún no tiene coordenadas), NO se bloquea la checada:
  -- se marca 'sin_geocerca' y RH lo ve. Un empleado que no puede fichar a las 8am
  -- porque su clínica no está dada de alta es un problema peor que el que resuelve.
  select u.sucursal into v_nombre_suc
  from public.usuarios u where u.id = v_usuario;

  select * into v_sucursal
  from public.sucursales s
  where s.nombre = v_nombre_suc and s.activa = true;

  if p_lat is null or p_lng is null then
    v_estado    := 'sin_gps';
    v_distancia := null;
  elsif v_sucursal.id is null or v_sucursal.lat is null then
    v_estado    := 'sin_geocerca';
    v_distancia := null;
  else
    v_distancia := public.distancia_metros(p_lat, p_lng, v_sucursal.lat, v_sucursal.lng);
    v_estado    := case
                     when v_distancia <= v_sucursal.radio_m then 'dentro'::public.estado_ubicacion
                     else 'fuera'::public.estado_ubicacion
                   end;
  end if;

  insert into public.asistencias (
    empleado_id, tipo, fecha, marcada_en,
    lat, lng, precision_m,
    sucursal_id, distancia_m, ubicacion_estado,
    selfie_path, origen
  ) values (
    v_usuario, p_tipo, v_fecha, now(),   -- <- hora del servidor, siempre
    p_lat, p_lng, p_precision,
    v_sucursal.id, v_distancia, v_estado,
    p_selfie_path, 'empleado'
  )
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.registrar_checada(public.tipo_checada, numeric, numeric, integer, text) from public, anon;
grant execute on function public.registrar_checada(public.tipo_checada, numeric, numeric, integer, text) to authenticated;

revoke all on function public.distancia_metros(numeric, numeric, numeric, numeric) from public, anon;


alter table public.asistencias enable row level security;

-- Grants explícitos, a propósito.
--
-- Los privilegios por defecto de Supabase solo conceden SELECT/INSERT/UPDATE a
-- anon/authenticated para las tablas que crea el rol supabase_admin. Las migraciones
-- corren como postgres, cuyo default privilege es únicamente Dxtm (truncate,
-- references, trigger): sin esta línea, la tabla queda con "permission denied for
-- table asistencias" para cualquier usuario de la app, y RLS ni siquiera llega a
-- evaluarse. Comprobado en una instancia local recién levantada desde estas mismas
-- migraciones.
--
-- Conceder el privilegio NO es conceder el acceso: quién ve y escribe qué lo siguen
-- decidiendo enteramente las policies de abajo. El grant solo abre la puerta para que
-- RLS pueda hacer de portero.
--
-- A 'anon' no se le concede nada: sin sesión no hay nada que ver aquí.
grant select, insert, update on public.asistencias to authenticated;
-- service_role: lo necesita api/verificar-rostro.js para escribir el resultado del cotejo.
-- Saltarse RLS no da privilegios de tabla: son dos cosas distintas y hacen falta las dos.
grant select, insert, update on public.asistencias to service_role;

-- Lectura: lo suyo cada quien.
drop policy if exists asistencias_select_own on public.asistencias;
create policy asistencias_select_own
  on public.asistencias for select
  using (empleado_id = (select public.current_usuario_id()));

-- Lectura: admin y rh ven todo (el panel y los reportes).
-- La psicóloga NO: la asistencia es un dato laboral, no clínico, y su rol ya tiene
-- acceso a lo más sensible de la app. Sumarle esto no le aporta nada y amplía la
-- superficie de exposición sin motivo.
drop policy if exists asistencias_select_admin_rh on public.asistencias;
create policy asistencias_select_admin_rh
  on public.asistencias for select
  using ((select public.current_role()) in ('admin', 'rh'));

-- INSERT directo: SOLO rh, y solo para altas manuales (origen 'rh') — el caso real de
-- "se le murió el teléfono y no pudo checar". El empleado NO tiene policy de insert:
-- su único camino es la RPC. Ese hueco es deliberado y es lo que hace que la hora del
-- servidor sea inevitable.
drop policy if exists asistencias_insert_rh on public.asistencias;
create policy asistencias_insert_rh
  on public.asistencias for insert
  with check ((select public.current_role()) = 'rh');

-- UPDATE: solo rh, para anular y anotar. Mismo criterio que permisos_update_rh.
drop policy if exists asistencias_update_rh on public.asistencias;
create policy asistencias_update_rh
  on public.asistencias for update
  using ((select public.current_role()) = 'rh')
  with check ((select public.current_role()) = 'rh');

-- Sin policy de DELETE: una checada es un documento laboral. Se anula, no se borra.


-- Realtime: el panel de RH se pinta solo cuando alguien checa (patrón idempotente
-- de la migración 024).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'asistencias'
  ) then
    alter publication supabase_realtime add table public.asistencias;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (autenticado como un empleado):
--
--   select * from public.registrar_checada('entrada', 22.2331, -97.8611, 15, null);
--     -> devuelve la fila. marcada_en = hora del SERVIDOR (no la del cliente).
--
--   select * from public.registrar_checada('entrada', 22.2331, -97.8611, 15, null);
--     -> ERROR: "Ya registraste tu entrada hace unos segundos." (anti doble-clic)
--
--   insert into public.asistencias (empleado_id, tipo, fecha, marcada_en, ubicacion_estado)
--   values (public.current_usuario_id(), 'entrada', '2020-01-01', '2020-01-01 09:00', 'dentro');
--     -> DEBE FALLAR (violates row-level security policy). Si esto pasa, el diseño
--        entero se cae: significa que alguien puede inventarse la hora de entrada.
--
--   select public.distancia_metros(22.2331, -97.8611, 22.2331, -97.8611);  -> 0
--
-- ROLLBACK:
--   drop function if exists public.registrar_checada(public.tipo_checada, numeric, numeric, integer, text);
--   drop function if exists public.distancia_metros(numeric, numeric, numeric, numeric);
--   drop table if exists public.asistencias;
--   drop type if exists public.tipo_checada;
--   drop type if exists public.estado_ubicacion;
-- ----------------------------------------------------------------------------
