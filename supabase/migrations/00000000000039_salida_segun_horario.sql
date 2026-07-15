-- ============================================================================
-- La salida solo se puede registrar cerca de la hora en que toca salir.
--
-- Hueco que cierra: el guard de la migración 36 solo bloqueaba checadas del MISMO
-- tipo en 90 s. Nada impedía registrar la entrada y, dos segundos después, la salida
-- — dejando una jornada de 0 minutos en el registro. Y el botón de salida aparece en
-- el mismo sitio de la pantalla donde el empleado acaba de pulsar el de entrada, así
-- que en un móvil un doble toque le cerraba el día sin querer.
--
-- Regla: la salida se habilita 10 minutos antes de la `hora_salida` de su horario de
-- ese día, y a partir de ahí siempre (no hay tope por arriba: quedarse hasta tarde es
-- legítimo y debe quedar registrado).
--
-- Se ata al HORARIO y no a una duración mínima fija porque es lo que significa de
-- verdad "ya terminé mi turno". Un mínimo de N minutos sería arbitrario y seguiría
-- permitiendo fichar la jornada entera de golpe a las 9 de la mañana.
--
-- CONSECUENCIA ACEPTADA: quien se vaya antes de tiempo (se sintió mal, permiso de
-- media jornada) NO podrá checar su salida. Su día quedará como "sin salida" y RH
-- tendrá que registrarla a mano. Es fricción real, pero es exactamente el caso que
-- alguien DEBE mirar, así que aparecer como incidencia es lo correcto. El mensaje de
-- error se lo dice.
--
-- Sin horario ese día (descanso, alguien cubriendo un turno que no es suyo) no hay
-- hora contra la que comparar: se permite la salida sin restricción.
-- ============================================================================

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
  c_tz            constant text := 'America/Monterrey';
  -- Margen con el que se abre la salida antes de la hora del turno.
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

  v_fecha      := (now() at time zone c_tz)::date;
  v_hora_local := (now() at time zone c_tz)::time;

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

  if p_tipo = 'salida' then
    -- Una salida sin entrada ese día es un dato imposible: bloquearla aquí evita que
    -- el historial tenga días que no se pueden emparejar ni interpretar.
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

    -- Y no antes de que su turno esté a punto de terminar.
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

  -- Geocerca. usuarios.sucursal es texto libre; si no casa con ninguna fila de
  -- sucursales (o la clínica aún no tiene coordenadas), NO se bloquea la checada:
  -- se marca 'sin_geocerca' y RH lo ve.
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

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (como un empleado con turno de 09:00 a 18:00):
--
--   select * from public.registrar_checada('entrada', ...);  -> OK
--   select * from public.registrar_checada('salida', ...);   -> a las 10:00: ERROR
--     "Tu turno termina a las 18:00, podrás checar a partir de las 17:50."
--   (a las 17:55)                                            -> OK
--
-- Un empleado SIN horario ese día puede checar salida a cualquier hora.
--
-- ROLLBACK: reaplicar el cuerpo de la función tal como está en la migración 036.
-- ----------------------------------------------------------------------------
