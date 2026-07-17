-- Geocerca BLOQUEANTE.
--
-- Hasta aquí la ubicación nunca impedía fichar: se calculaba el estado ('dentro'/'fuera'/
-- 'sin_gps'/'sin_geocerca'), se guardaba, y RH lo revisaba después. Decisión de producto que
-- ahora se invierte: quien esté FUERA del área no debe poder registrar, y quien no aporte GPS
-- tampoco (negar el permiso era la puerta de salida evidente).
--
-- Tres piezas, una sola regla:
--   1. evaluar_ubicacion(): la fórmula, en un único sitio. La usan tanto el pre-chequeo como
--      registrar_checada, para que la etiqueta que ve RH y la que decide el bloqueo NUNCA
--      difieran.
--   2. checar_ubicacion(): el veredicto barato que api/checar.js consulta ANTES del cotejo de
--      cara (dos inferencias de red neuronal). La geocerca es lo barato de verificar; va antes
--      de lo caro, como el resto de guardias del handler.
--   3. registrar_checada(): su bloque inline de cálculo pasa a llamar evaluar_ubicacion. Sigue
--      SIN bloquear —el bloqueo vive en el handler—, solo etiqueta la fila con el mismo criterio.

-- ---------------------------------------------------------------------------
-- 1. La fórmula, una sola vez.
-- ---------------------------------------------------------------------------
--
-- El MARGEN DE PRECISIÓN es lo que hace esto usable con radios de 5–20 m. El GPS de un teléfono
-- dentro de una clínica reporta su propia incertidumbre (`precision`, en metros): "estás a 40 m,
-- ±60". Comparar la distancia cruda contra un radio chico rechazaría a diario a gente parada en
-- su sitio. Se le da el beneficio de su propio margen —solo está 'fuera' si lo está incluso
-- descontando su incertidumbre— con un tope de 100 m para que un GPS malísimo no vuelva la
-- geocerca infinita.
create or replace function public.evaluar_ubicacion(
  p_lat        numeric,
  p_lng        numeric,
  p_precision  integer,
  p_suc_lat    numeric,
  p_suc_lng    numeric,
  p_radio      integer,
  out estado    public.estado_ubicacion,
  out distancia integer
)
language sql
immutable
as $function$
  select
    case
      when p_lat is null or p_lng is null
        then 'sin_gps'::public.estado_ubicacion
      when p_suc_lat is null or p_suc_lng is null
        then 'sin_geocerca'::public.estado_ubicacion
      when public.distancia_metros(p_lat, p_lng, p_suc_lat, p_suc_lng)
             - least(coalesce(p_precision, 0), 100) <= p_radio
        then 'dentro'::public.estado_ubicacion
      else 'fuera'::public.estado_ubicacion
    end,
    case
      when p_lat is null or p_lng is null or p_suc_lat is null or p_suc_lng is null
        then null
      else public.distancia_metros(p_lat, p_lng, p_suc_lat, p_suc_lng)
    end;
$function$;

revoke all on function public.evaluar_ubicacion(numeric, numeric, integer, numeric, numeric, integer) from public, anon;
grant execute on function public.evaluar_ubicacion(numeric, numeric, integer, numeric, numeric, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. El veredicto barato para el pre-chequeo del handler.
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER: resuelve la sucursal del empleado por su cuenta (usuarios.sucursal ->
-- sucursales), igual que registrar_checada, para que el cliente no pueda decir "mi radio es
-- otro". Sin sucursal activa o sin coordenadas -> 'sin_geocerca' (pasa; es un error de config,
-- no del empleado).
create or replace function public.checar_ubicacion(
  p_empleado_id uuid,
  p_lat         numeric,
  p_lng         numeric,
  p_precision   integer,
  out estado    public.estado_ubicacion,
  out distancia integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nombre_suc text;
  v_sucursal   public.sucursales%rowtype;
begin
  if p_empleado_id is null then
    raise exception 'No autenticado.';
  end if;

  select u.sucursal into v_nombre_suc from public.usuarios u where u.id = p_empleado_id;
  select * into v_sucursal from public.sucursales s
  where s.nombre = v_nombre_suc and s.activa = true;

  select e.estado, e.distancia
    into estado, distancia
  from public.evaluar_ubicacion(
    p_lat, p_lng, p_precision,
    v_sucursal.lat, v_sucursal.lng, v_sucursal.radio_m
  ) e;
end;
$function$;

revoke all on function public.checar_ubicacion(uuid, numeric, numeric, integer) from public, anon, authenticated;
grant execute on function public.checar_ubicacion(uuid, numeric, numeric, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3. registrar_checada: mismo cálculo, un solo sitio.
-- ---------------------------------------------------------------------------
--
-- Se recrea completa (misma firma y cuerpo que la 053) cambiando SOLO el bloque de ubicación:
-- el case inline pasa a evaluar_ubicacion, para que la fila que se guarda use el mismo criterio
-- con margen que el pre-chequeo. No bloquea aquí: si el handler la llamó, la ubicación ya pasó.
create or replace function public.registrar_checada(
  p_empleado_id uuid,
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
set search_path to 'public'
as $function$
declare
  c_tz            constant text := 'America/Monterrey';
  c_margen_salida constant interval := interval '15 minutes';
  c_jornada_minima constant interval := interval '30 minutes';

  v_sucursal        public.sucursales%rowtype;
  v_nombre_suc      text;
  v_fecha           date;
  v_hora_local      time;
  v_hora_turno      time;
  v_hora_autorizada time;
  v_hora_limite     time;
  v_distancia       integer;
  v_estado          public.estado_ubicacion;
  v_ultima          public.asistencias%rowtype;
  v_entrada_en      timestamptz;
  v_conocido        boolean;
  v_tenia_alguno    boolean;
  v_disp_nuevo      boolean := false;
  v_fila            public.asistencias%rowtype;
begin
  if p_empleado_id is null then
    raise exception 'No autenticado.';
  end if;

  perform pg_advisory_xact_lock(hashtext('checada:' || p_empleado_id::text));

  v_fecha      := (now() at time zone c_tz)::date;
  v_hora_local := (now() at time zone c_tz)::time;

  select * into v_ultima
  from public.asistencias
  where empleado_id = p_empleado_id and tipo = p_tipo and anulada = false
  order by marcada_en desc
  limit 1;

  if found and v_ultima.marcada_en > now() - interval '90 seconds' then
    raise exception 'Ya registraste tu % hace unos segundos.', p_tipo;
  end if;

  if p_tipo = 'salida' then
    select min(marcada_en) into v_entrada_en
    from public.asistencias
    where empleado_id = p_empleado_id and fecha = v_fecha
      and tipo = 'entrada' and anulada = false;

    if v_entrada_en is null then
      raise exception 'No puedes registrar tu salida: hoy no tienes una entrada registrada.';
    end if;

    if now() < v_entrada_en + c_jornada_minima then
      raise exception
        'Acabas de registrar tu entrada. Podrás fichar la salida a partir de las %.',
        to_char((v_entrada_en + c_jornada_minima) at time zone c_tz, 'HH24:MI');
    end if;

    select h.hora_salida into v_hora_turno
    from public.horarios h
    where h.empleado_id = p_empleado_id
      and h.dia_semana = extract(isodow from v_fecha);

    select min(p.hora) into v_hora_autorizada
    from public.permisos p
    where p.empleado_id = p_empleado_id
      and p.estado = 'aprobado'
      and p.causa = 'salida_anticipada'
      and p.hora is not null
      and v_fecha between p.fecha and coalesce(p.fecha_fin, p.fecha);

    if v_hora_turno is not null then
      v_hora_limite := least(coalesce(v_hora_autorizada, v_hora_turno), v_hora_turno);

      if v_hora_local < (v_hora_limite - c_margen_salida) then
        if v_hora_autorizada is not null and v_hora_autorizada < v_hora_turno then
          raise exception
            'Tu salida está autorizada para las %. Podrás checar a partir de las %.',
            to_char(v_hora_autorizada, 'HH24:MI'),
            to_char(v_hora_limite - c_margen_salida, 'HH24:MI');
        else
          raise exception
            'Todavía no puedes registrar tu salida. Tu turno termina a las %, podrás checar a partir de las %. Si necesitas irte antes, pide un permiso de salida anticipada a Recursos Humanos.',
            to_char(v_hora_turno, 'HH24:MI'),
            to_char(v_hora_limite - c_margen_salida, 'HH24:MI');
        end if;
      end if;
    end if;
  end if;

  if p_device_id is not null then
    select exists (
      select 1 from public.dispositivos
      where empleado_id = p_empleado_id and device_id = p_device_id
    ) into v_conocido;

    select exists (
      select 1 from public.dispositivos where empleado_id = p_empleado_id
    ) into v_tenia_alguno;

    v_disp_nuevo := (not v_conocido) and v_tenia_alguno;

    insert into public.dispositivos (empleado_id, device_id)
    values (p_empleado_id, p_device_id)
    on conflict (empleado_id, device_id) do update set ultimo_uso = now();
  end if;

  select u.sucursal into v_nombre_suc from public.usuarios u where u.id = p_empleado_id;
  select * into v_sucursal from public.sucursales s
  where s.nombre = v_nombre_suc and s.activa = true;

  -- Ubicación: misma fórmula (con margen de precisión) que el pre-chequeo del handler.
  select e.estado, e.distancia
    into v_estado, v_distancia
  from public.evaluar_ubicacion(
    p_lat, p_lng, p_precision,
    v_sucursal.lat, v_sucursal.lng, v_sucursal.radio_m
  ) e;

  insert into public.asistencias (
    empleado_id, tipo, fecha, marcada_en,
    lat, lng, precision_m,
    sucursal_id, distancia_m, ubicacion_estado,
    selfie_path, origen, device_id, dispositivo_nuevo
  ) values (
    p_empleado_id, p_tipo, v_fecha, now(),
    p_lat, p_lng, p_precision,
    v_sucursal.id, v_distancia, v_estado,
    p_selfie_path, 'empleado', p_device_id, v_disp_nuevo
  )
  returning * into v_fila;

  return v_fila;
end;
$function$;

revoke all on function public.registrar_checada(uuid, public.tipo_checada, numeric, numeric, integer, text, text) from public, anon, authenticated;
grant execute on function public.registrar_checada(uuid, public.tipo_checada, numeric, numeric, integer, text, text) to service_role;
