-- ============================================================================
-- Desde qué teléfono se checa.
--
-- EL VECTOR REAL DE FRAUDE NO ES LA FOTO: es la contraseña compartida. Un compañero
-- entra con tu usuario, se hace un selfie y el sistema lo da por bueno. La cara no
-- delata eso —salvo que se coteje contra la tuya, que es caro y es dato biométrico—,
-- pero el TELÉFONO sí: quien checa por ti lo hace desde el suyo.
--
-- Dos señales, y son de calidad muy distinta:
--
--   1. `dispositivo_nuevo`: este empleado nunca había checado desde este teléfono.
--      RUIDOSA: la gente cambia de móvil, borra los datos del navegador, usa el modo
--      incógnito. Por eso NO bloquea nada — se marca y RH decide. Su primer dispositivo
--      nunca se marca (todo el mundo empieza por uno).
--
--   2. Un mismo teléfono checando a DOS empleados distintos el mismo día. Esta es la
--      buena: es la firma exacta de la suplantación y no tiene una explicación inocente
--      frecuente. NO se guarda como columna: se DERIVA al leer, igual que el estado del
--      día (ver detectarDispositivosCompartidos en src/utils/asistencia.js). Guardarla
--      obligaría a reescribir la primera checada del día cuando llega la segunda.
--
-- LÍMITE HONESTO: el id lo genera el navegador, así que alguien decidido puede borrarlo
-- o inventarse otro. Pero le sale caro: un id nuevo se marca como desconocido, que es
-- justo la señal que se buscaba. Esto no es una barrera, es un detector — barato, sin
-- datos sensibles y sin necesidad de consentimiento especial.
-- ============================================================================

alter table public.asistencias
  add column if not exists device_id         text,
  add column if not exists dispositivo_nuevo boolean not null default false;

comment on column public.asistencias.device_id is
  'Id del navegador desde el que se checó (localStorage). null = no se pudo obtener (incógnito, storage bloqueado): la checada se registra igual.';
comment on column public.asistencias.dispositivo_nuevo is
  'true = este empleado nunca había checado desde este dispositivo, Y ya tenía otros. Señal para RH, NO un bloqueo.';

-- Dispositivos que ya se le conocen a cada empleado.
create table if not exists public.dispositivos (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.usuarios(id) on delete cascade,
  device_id   text not null,
  primer_uso  timestamptz not null default now(),
  ultimo_uso  timestamptz not null default now()
);

create unique index if not exists uq_dispositivos_empleado_device
  on public.dispositivos (empleado_id, device_id);

comment on table public.dispositivos is
  'Teléfonos conocidos de cada empleado. Lo escribe SOLO registrar_checada(); el cliente no puede tocarlo — si pudiera, bastaría con darse de alta el suyo para que nunca saliera marcado. Ver migración 040.';

alter table public.dispositivos enable row level security;

-- Lectura: RH y admin (la investigación de una checada sospechosa). El empleado NO ve
-- esta tabla: no le aporta nada y expone la huella de sus dispositivos.
grant select on public.dispositivos to authenticated;
grant select, insert, update on public.dispositivos to service_role;

drop policy if exists dispositivos_select_admin_rh on public.dispositivos;
create policy dispositivos_select_admin_rh
  on public.dispositivos for select
  using ((select public.current_role()) in ('admin', 'rh'));

-- Sin policies de INSERT/UPDATE/DELETE, a propósito: la única forma de escribir aquí es
-- la RPC (security definer). Si el cliente pudiera insertar, se daría de alta su propio
-- dispositivo antes de checar y la señal valdría cero.


create or replace function public.registrar_checada(
  p_tipo        public.tipo_checada,
  p_lat         numeric default null,
  p_lng         numeric default null,
  p_precision   integer default null,
  p_selfie_path text    default null,
  p_device_id   text    default null
)
returns public.asistencias
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tz            constant text := 'America/Monterrey';
  c_margen_salida constant interval := interval '10 minutes';

  v_usuario       uuid;
  v_sucursal      public.sucursales%rowtype;
  v_nombre_suc    text;
  v_fecha         date;
  v_hora_local    time;
  v_hora_salida   time;
  v_distancia     integer;
  v_estado        public.estado_ubicacion;
  v_ultima        public.asistencias%rowtype;
  v_tiene_entrada boolean;
  v_conocido      boolean;
  v_tenia_alguno  boolean;
  v_disp_nuevo    boolean := false;
  v_fila          public.asistencias%rowtype;
begin
  v_usuario := public.current_usuario_id();
  if v_usuario is null then
    raise exception 'No autenticado.';
  end if;

  perform pg_advisory_xact_lock(hashtext('checada:' || v_usuario::text));

  v_fecha      := (now() at time zone c_tz)::date;
  v_hora_local := (now() at time zone c_tz)::time;

  -- Anti doble-clic: misma checada, mismo tipo, hace menos de 90 s.
  select * into v_ultima
  from public.asistencias
  where empleado_id = v_usuario and tipo = p_tipo and anulada = false
  order by marcada_en desc
  limit 1;

  if found and v_ultima.marcada_en > now() - interval '90 seconds' then
    raise exception 'Ya registraste tu % hace unos segundos.', p_tipo;
  end if;

  if p_tipo = 'salida' then
    select exists (
      select 1 from public.asistencias
      where empleado_id = v_usuario and fecha = v_fecha
        and tipo = 'entrada' and anulada = false
    ) into v_tiene_entrada;

    if not v_tiene_entrada then
      raise exception 'No puedes registrar tu salida: hoy no tienes una entrada registrada.';
    end if;

    -- No antes de que su turno esté a punto de terminar (migración 039).
    select h.hora_salida into v_hora_salida
    from public.horarios h
    where h.empleado_id = v_usuario
      and h.dia_semana = extract(isodow from v_fecha);

    if v_hora_salida is not null and v_hora_local < (v_hora_salida - c_margen_salida) then
      raise exception
        'Todavía no puedes registrar tu salida. Tu turno termina a las %, podrás checar a partir de las %. Si necesitas irte antes, avisa a Recursos Humanos.',
        to_char(v_hora_salida, 'HH24:MI'),
        to_char(v_hora_salida - c_margen_salida, 'HH24:MI');
    end if;
  end if;

  -- Dispositivo. Se marca solo si el empleado YA tenía otros: el primer teléfono de
  -- alguien no es sospechoso, es simplemente el primero.
  if p_device_id is not null then
    select exists (
      select 1 from public.dispositivos
      where empleado_id = v_usuario and device_id = p_device_id
    ) into v_conocido;

    select exists (
      select 1 from public.dispositivos where empleado_id = v_usuario
    ) into v_tenia_alguno;

    v_disp_nuevo := (not v_conocido) and v_tenia_alguno;

    insert into public.dispositivos (empleado_id, device_id)
    values (v_usuario, p_device_id)
    on conflict (empleado_id, device_id)
      do update set ultimo_uso = now();
  end if;

  -- Geocerca.
  select u.sucursal into v_nombre_suc from public.usuarios u where u.id = v_usuario;
  select * into v_sucursal from public.sucursales s
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
    selfie_path, origen, device_id, dispositivo_nuevo
  ) values (
    v_usuario, p_tipo, v_fecha, now(),
    p_lat, p_lng, p_precision,
    v_sucursal.id, v_distancia, v_estado,
    p_selfie_path, 'empleado', p_device_id, v_disp_nuevo
  )
  returning * into v_fila;

  return v_fila;
end;
$$;

-- La firma cambió (un parámetro más), así que la versión de 5 argumentos sigue existiendo
-- y sería un camino de escritura sin control de dispositivo. Se elimina.
drop function if exists public.registrar_checada(public.tipo_checada, numeric, numeric, integer, text);

revoke all on function public.registrar_checada(public.tipo_checada, numeric, numeric, integer, text, text) from public, anon;
grant execute on function public.registrar_checada(public.tipo_checada, numeric, numeric, integer, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   1ª checada de un empleado con device 'A'  -> dispositivo_nuevo = false (es el primero)
--   2ª con 'A'                                -> false
--   1ª con 'B'                                -> TRUE (ya tenía otro)
--
--   (como empleado) insert into public.dispositivos ... -> DEBE FALLAR: sin policy de
--   insert. Si pudiera, se daría de alta su teléfono antes de checar y la señal valdría 0.
--
-- ROLLBACK:
--   drop table if exists public.dispositivos;
--   alter table public.asistencias drop column if exists device_id, drop column if exists dispositivo_nuevo;
--   (y reaplicar registrar_checada de la migración 039)
-- ----------------------------------------------------------------------------
