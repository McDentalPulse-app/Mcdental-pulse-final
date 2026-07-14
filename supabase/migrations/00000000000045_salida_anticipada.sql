-- ============================================================================
-- Salida anticipada: irse antes de la hora, con permiso de RH.
--
-- La ventana de salida (migración 039) abre 10 minutos antes de la hora del turno. Eso
-- deja fuera un caso perfectamente legítimo y cotidiano: "hoy me tengo que ir a las 3".
--
-- NO SE INVENTA UN MECANISMO NUEVO. El módulo de `permisos` ya tiene todo lo que hace falta
-- —solicitud, aprobación de RH, estado, causa, comentario— y hasta una columna `hora` que
-- estaba sin usar, esperando exactamente esto.
--
-- Un MENSAJE a RH no habría servido: un mensaje no puede desbloquear un botón (alguien
-- tendría que leerlo e interpretarlo) y no deja rastro auditable — dentro de tres meses,
-- "¿quién autorizó que Juan se fuera a las 3?" sería buscar en una conversación. Un permiso
-- aprobado es un registro con estado, hora y responsable, y el sistema puede ACTUAR sobre él.
--
-- CÓMO FUNCIONA: si hay un permiso aprobado de causa 'salida_anticipada' que cubra hoy y
-- traiga una hora, esa hora sustituye a la del turno para calcular la ventana. Autorizado a
-- las 15:00 -> puede checar salida desde las 14:50.
--
-- Solo puede ADELANTAR la salida, nunca retrasarla (least): un permiso mal capturado con
-- hora 20:00 no puede dejar a alguien sin poder fichar a su hora normal.
--
-- LO URGENTE NO PASA POR AQUÍ. Quien se sienta mal a las once de la mañana se va, sin más.
-- Su día queda "sin salida", RH lo ve marcado y le registra la salida a mano con la hora
-- real (el alta manual ya existe). Una persona enferma no debería estar peleándose con una
-- app, y una incidencia visible que alguien mira es mejor que un trámite que nadie cumple.
-- ============================================================================

-- Nueva causa en el catálogo (migración 038).
alter table public.permisos drop constraint if exists permisos_causa_valida;
alter table public.permisos add constraint permisos_causa_valida check (
  causa is null or causa in (
    'enfermedad',
    'cita_medica',
    'asunto_personal',
    'luto',
    'tramite_oficial',
    'salida_anticipada',
    'otro'
  )
);

comment on column public.permisos.hora is
  'Para causa = salida_anticipada: la hora a la que se le autoriza salir. Sustituye a la hora de su turno al calcular la ventana de salida del checador (migración 045). Para las demás causas, informativa.';


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
set search_path = public
as $$
declare
  c_tz            constant text := 'America/Monterrey';
  c_margen_salida constant interval := interval '10 minutes';

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
  v_tiene_entrada   boolean;
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
    select exists (
      select 1 from public.asistencias
      where empleado_id = p_empleado_id and fecha = v_fecha
        and tipo = 'entrada' and anulada = false
    ) into v_tiene_entrada;

    if not v_tiene_entrada then
      raise exception 'No puedes registrar tu salida: hoy no tienes una entrada registrada.';
    end if;

    select h.hora_salida into v_hora_turno
    from public.horarios h
    where h.empleado_id = p_empleado_id
      and h.dia_semana = extract(isodow from v_fecha);

    -- ¿Le autorizaron irse antes hoy? (permiso aprobado, causa salida_anticipada, con hora)
    -- Si hay varios, el MÁS TEMPRANO: es el que más le beneficia y no hay motivo para
    -- aplicarle el más restrictivo de dos permisos que él mismo pidió y RH aprobó.
    select min(p.hora) into v_hora_autorizada
    from public.permisos p
    where p.empleado_id = p_empleado_id
      and p.estado = 'aprobado'
      and p.causa = 'salida_anticipada'
      and p.hora is not null
      and v_fecha between p.fecha and coalesce(p.fecha_fin, p.fecha);

    if v_hora_turno is not null then
      -- least(): el permiso solo puede ADELANTAR la salida, nunca retrasarla. Un permiso mal
      -- capturado con hora 20:00 no puede dejar a alguien sin poder fichar a su hora normal.
      v_hora_limite := least(coalesce(v_hora_autorizada, v_hora_turno), v_hora_turno);

      if v_hora_local < (v_hora_limite - c_margen_salida) then
        -- Solo se le habla del permiso si el permiso está ADELANTANDO algo. Decirle "tu
        -- salida está autorizada para las 23:00" cuando ese permiso se está ignorando (por
        -- estar mal capturado) es confundirle con un dato que no aplica.
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
    p_empleado_id, p_tipo, v_fecha, now(),
    p_lat, p_lng, p_precision,
    v_sucursal.id, v_distancia, v_estado,
    p_selfie_path, 'empleado', p_device_id, v_disp_nuevo
  )
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.registrar_checada(uuid, public.tipo_checada, numeric, numeric, integer, text, text) from public, anon, authenticated;
grant execute on function public.registrar_checada(uuid, public.tipo_checada, numeric, numeric, integer, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (empleado con turno 09:00-18:00, a las 14:55):
--   sin permiso                         -> ERROR: podrás checar a partir de las 17:50
--   con permiso aprobado, hora 15:00    -> ERROR hasta las 14:50, y a partir de ahí OK
--   con permiso aprobado, hora 20:00    -> se ignora (least): sigue mandando su turno
--   permiso PENDIENTE (sin aprobar)     -> se ignora: no autoriza nada
--
-- ROLLBACK: reaplicar registrar_checada de la migración 043.
-- ----------------------------------------------------------------------------
