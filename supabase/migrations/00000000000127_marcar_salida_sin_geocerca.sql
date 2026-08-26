-- Permiso por empleado: marcar SALIDA desde cualquier lugar, sin geocerca. Distinto de
-- puede_marcar_en_cualquier_clinica (mig. 118), que sigue exigiendo estar dentro del área de
-- ALGUNA clínica — este quita la geocerca por completo, y solo para la salida. La entrada
-- sigue exigiendo presencia física siempre: es lo que evita que alguien "entre" sin estar ahí.

alter table public.usuarios
  add column if not exists puede_marcar_salida_sin_geocerca boolean not null default false;

comment on column public.usuarios.puede_marcar_salida_sin_geocerca is
  'Permite registrar la SALIDA sin exigir estar dentro del área de ninguna clínica. La entrada '
  'sigue exigiendo geocerca siempre. Pensado para quien sale antes de terminar turno y no vuelve '
  'a estar en una clínica ese día.';

-- sucursal_para_checada: se le agrega p_tipo (default null, así no rompe llamadas viejas).
-- Con el permiso encendido y p_tipo = 'salida', devuelve de una vez la clínica asignada como
-- 'dentro' sin evaluar el GPS — se reusa 'dentro' (no un estado nuevo) porque es lo correcto
-- para reportes: se le atribuye su clínica de siempre, igual que ya hace el permiso 118.
create or replace function public.sucursal_para_checada(
  p_empleado_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_precision integer,
  p_tipo public.tipo_checada default null,
  out sucursal_id uuid,
  out estado public.estado_ubicacion,
  out distancia integer
)
returns record
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nombre_suc text;
  v_permiso    boolean;
  v_salida_libre boolean;
  v_asignada   public.sucursales%rowtype;
  v_mejor      record;
begin
  if p_empleado_id is null then
    raise exception 'No autenticado.';
  end if;

  select u.sucursal, coalesce(u.puede_marcar_en_cualquier_clinica, false),
         coalesce(u.puede_marcar_salida_sin_geocerca, false)
    into v_nombre_suc, v_permiso, v_salida_libre
  from public.usuarios u
  where u.id = p_empleado_id;

  select * into v_asignada from public.sucursales s
   where s.nombre = v_nombre_suc and s.activa = true;

  sucursal_id := v_asignada.id;

  -- Salida libre: se resuelve antes que cualquier evaluación de GPS.
  if p_tipo = 'salida' and v_salida_libre then
    estado := 'dentro'::public.estado_ubicacion;
    distancia := null;
    return;
  end if;

  -- Su clínica SIEMPRE se evalúa primero, tenga el permiso o no. Con el permiso encendido esto
  -- además evita mover de sucursal a quien está en la suya y tiene otra clínica pegada al lado.
  select e.estado, e.distancia
    into estado, distancia
  from public.evaluar_ubicacion(
    p_lat, p_lng, p_precision,
    v_asignada.lat, v_asignada.lng, v_asignada.radio_m
  ) e;

  -- Sin permiso, o ya resuelto ('dentro' pasa, 'sin_gps' bloquea, 'sin_geocerca' pasa porque es
  -- un olvido del admin y no del empleado): esto es exactamente lo de siempre.
  if not v_permiso or estado is distinct from 'fuera'::public.estado_ubicacion then
    return;
  end if;

  -- Con permiso y fuera de la suya: ¿está dentro de alguna otra? Se ordena poniendo delante las
  -- que dan 'dentro' y, entre ellas, la más cercana. La misma consulta sirve para el caso malo:
  -- si ninguna da 'dentro', la primera fila es la clínica más cercana y su distancia es la que
  -- se le enseña ("estás a 4200 m"), que es la única cifra que le dice algo.
  select s.id as id, e.estado as estado, e.distancia as distancia
    into v_mejor
  from public.sucursales s
  cross join lateral public.evaluar_ubicacion(
    p_lat, p_lng, p_precision, s.lat, s.lng, s.radio_m
  ) e
  where s.activa = true and s.lat is not null and s.lng is not null
  order by (e.estado = 'dentro'::public.estado_ubicacion) desc, e.distancia asc
  limit 1;

  if not found then
    return; -- ninguna clínica con coordenadas: se queda el veredicto de la suya
  end if;

  distancia := v_mejor.distancia;

  if v_mejor.estado = 'dentro'::public.estado_ubicacion then
    sucursal_id := v_mejor.id;
    estado      := v_mejor.estado;
  end if;
end;
$function$;

-- checar_ubicacion: reenvía p_tipo, mismo truco de default null para no romper a nadie.
create or replace function public.checar_ubicacion(
  p_empleado_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_precision integer,
  p_tipo public.tipo_checada default null,
  out estado public.estado_ubicacion,
  out distancia integer
)
returns record
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  select v.estado, v.distancia
    into estado, distancia
  from public.sucursal_para_checada(p_empleado_id, p_lat, p_lng, p_precision, p_tipo) v;
end;
$function$;

-- registrar_checada: misma firma de siempre, la única línea que cambia es la llamada a
-- sucursal_para_checada, que ahora recibe p_tipo (ya lo tiene como parámetro propio).
create or replace function public.registrar_checada(
  p_empleado_id uuid,
  p_tipo tipo_checada,
  p_lat numeric default null::numeric,
  p_lng numeric default null::numeric,
  p_precision integer default null::integer,
  p_selfie_path text default null::text,
  p_device_id text default null::text
)
returns asistencias
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c_jornada_minima constant interval := interval '30 minutes';
  c_tolerancia     constant interval := interval '30 minutes'; -- gracia para el aviso de salida

  v_tz              text;
  v_sucursal        public.sucursales%rowtype;
  v_nombre_suc      text;
  v_fecha           date;
  v_hora_local      time;
  v_hora_turno      time;
  v_hora_autorizada time;
  v_hora_limite     time;
  v_avisar_salida   boolean := false;
  v_sucursal_id     uuid;
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

  -- La sucursal PRIMERO: de ella sale la zona horaria, y de la zona horaria sale en qué día
  -- natural cae esta checada. Antes esto se resolvía más abajo y la fecha ya se había
  -- calculado con Monterrey — que para Hermosillo y Reynosa es la hora de otro sitio.
  select u.sucursal into v_nombre_suc from public.usuarios u where u.id = p_empleado_id;
  select * into v_sucursal from public.sucursales s
   where s.nombre = v_nombre_suc and s.activa = true;

  v_tz := coalesce(v_sucursal.zona_horaria, 'America/Monterrey');

  v_fecha      := (now() at time zone v_tz)::date;
  v_hora_local := (now() at time zone v_tz)::time;

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
        to_char((v_entrada_en + c_jornada_minima) at time zone v_tz, 'HH24:MI');
    end if;

    -- Sábado sin encuesta semanal contestada: no se deja marcar salida hasta que la conteste.
    if extract(isodow from v_fecha) = 6 then
      if not exists (
        select 1 from public.encuestas
        where empleado_id = p_empleado_id
          and semana = to_char(v_fecha, 'IYYY-"W"IW')
      ) then
        raise exception 'Antes de marcar tu salida el sábado, contesta la encuesta semanal.';
      end if;
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

    -- Ya NO se bloquea la salida temprano. Solo se marca para avisar a gestión si sale más de
    -- 30 min antes de su hora (least() respeta un permiso de salida anticipada: si lo tiene,
    -- la referencia es esa hora y no avisa por salir a la hora autorizada).
    if v_hora_turno is not null then
      v_hora_limite := least(coalesce(v_hora_autorizada, v_hora_turno), v_hora_turno);
      v_avisar_salida := v_hora_local < (v_hora_limite - c_tolerancia);
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

  -- Ubicación: mismo veredicto que el pre-chequeo del handler, y la clínica que sale de aquí es
  -- la que se guarda. Para quien no tiene el permiso, esto es su clínica asignada y ya.
  select v.sucursal_id, v.estado, v.distancia
    into v_sucursal_id, v_estado, v_distancia
  from public.sucursal_para_checada(p_empleado_id, p_lat, p_lng, p_precision, p_tipo) v;

  insert into public.asistencias (
    empleado_id, tipo, fecha, marcada_en,
    lat, lng, precision_m,
    sucursal_id, distancia_m, ubicacion_estado,
    selfie_path, origen, device_id, dispositivo_nuevo
  ) values (
    p_empleado_id, p_tipo, v_fecha, now(),
    p_lat, p_lng, p_precision,
    v_sucursal_id, v_distancia, v_estado,
    p_selfie_path, 'empleado', p_device_id, v_disp_nuevo
  )
  returning * into v_fila;

  -- Aviso a gestión de salida anticipada (bandeja). Va DESPUÉS de registrar: no bloquea nada.
  if p_tipo = 'salida' and v_avisar_salida then
    insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo, url)
    select u.id, 'checada', 'Salida anticipada',
           coalesce((select name from public.usuarios where id = p_empleado_id), 'Un empleado')
             || ' marcó salida a las ' || to_char(v_hora_local, 'HH24:MI')
             || ' (su turno termina a las ' || to_char(v_hora_turno, 'HH24:MI') || ').',
           case u.role when 'rh' then '/rh/asistencia' when 'psicologa' then '/psicologa/asistencia' else '/admin/asistencia' end
    from public.usuarios u
    where coalesce(u.inactivo, false) = false and u.role in ('rh', 'admin', 'psicologa');
  end if;

  return v_fila;
end;
$function$;
