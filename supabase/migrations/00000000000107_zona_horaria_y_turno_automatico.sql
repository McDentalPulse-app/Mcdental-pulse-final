-- Zona horaria POR SUCURSAL, y turno automático para las altas nuevas.
--
-- ============================================================================
-- 1. EL PROBLEMA DE LAS ZONAS HORARIAS
-- ============================================================================
--
-- Todo el sistema daba por hecho que la clínica entera vive en 'America/Monterrey'. No es
-- cierto, y se puede medir en los propios datos. Hora de entrada MEDIANA de cada sucursal,
-- leída como Monterrey, sobre 7 días:
--
--     McDental Reynosa .......... 09:04     ← una hora ANTES que todos
--     Popular Reynosa ........... 09:05     ← una hora ANTES que todos
--     ...las otras 21 ........... 09:53 a 10:13
--     McDental Hermosillo ....... 10:54     ← una hora DESPUÉS que todos
--
-- Dos desviaciones, en sentidos opuestos, de exactamente una hora:
--
--   · HERMOSILLO está en Sonora, que es UTC-7 y NO aplica horario de verano. Se le lee una
--     hora tarde. Con turno de 10:00 y 10 min de tolerancia, esto marcaba RETARDO todos los
--     días a gente que llegaba puntual: medido, Dania Limón entró a las 09:54 hora de
--     Hermosillo y el sistema le apuntó 55 minutos de retardo. Cuatro personas afectadas.
--
--   · REYNOSA es municipio fronterizo, y por el decreto de 2022 conserva el horario de verano
--     alineado con Estados Unidos: hoy (agosto) va en UTC-5, no en UTC-6. Se le lee una hora
--     temprano, así que sus retardos REALES son invisibles. Siete personas afectadas, y el
--     desfase desaparece solo en noviembre y vuelve en marzo — que es justo por lo que hay que
--     guardar el nombre IANA de la zona y no un desfase fijo en horas.
--
-- Lo bueno: el estado de un día (retardo, falta, presente) se DERIVA al leer, no se guarda.
-- En cuanto la zona horaria es la correcta, el histórico entero se corrige solo. No hay que
-- migrar ni recalcular una sola fila de `asistencias`.
--
-- ============================================================================
-- 2. EL PROBLEMA DE LAS ALTAS SIN HORARIO
-- ============================================================================
--
-- Ocho personas dadas de alta el 30-31 de julio, después de la carga masiva de horarios, se
-- quedaron con CERO turnos. Y un día sin fila de horario es DESCANSO por diseño (mig. 035), así
-- que sus días de trabajo real salían como descanso: no podían llegar tarde ni podían faltar.
-- Dieciocho días-persona así, y nadie se enteró porque el síntoma parece intencionado.
--
-- La causa es que se puede crear un usuario sin pasar nunca por la pantalla de horarios. El
-- trigger de abajo cierra ese camino: el turno estándar se crea con la persona.

-- ---------------------------------------------------------------------------
-- Zona horaria de cada sucursal
-- ---------------------------------------------------------------------------

alter table public.sucursales
  add column if not exists zona_horaria text not null default 'America/Monterrey';

comment on column public.sucursales.zona_horaria is
  'Nombre IANA de la zona horaria de la clínica (America/Monterrey, America/Hermosillo, '
  'America/Matamoros...). Se guarda el NOMBRE y no un desfase en horas a propósito: Reynosa '
  'cambia de desfase dos veces al año y un número fijo se rompería solo.';

update public.sucursales set zona_horaria = 'America/Hermosillo'
 where nombre = 'McDental Hermosillo';

-- Matamoros es la zona de los municipios fronterizos de Tamaulipas: UTC-6 en invierno y UTC-5
-- en verano, siguiendo a Estados Unidos. Es la que corresponde a Reynosa.
update public.sucursales set zona_horaria = 'America/Matamoros'
 where nombre in ('McDental Reynosa', 'Popular Reynosa');

-- Una zona horaria mal escrita rompería TODAS las checadas de esa clínica (`at time zone`
-- lanza excepción), y se descubriría a las ocho de la mañana con la gente en la puerta. Se
-- valida al escribir, que es cuando hay alguien mirando.
create or replace function public.validar_zona_horaria()
returns trigger
language plpgsql
as $$
begin
  perform now() at time zone new.zona_horaria;
  return new;
exception when others then
  raise exception 'Zona horaria inválida: %. Usa un nombre IANA como America/Monterrey.', new.zona_horaria;
end;
$$;

drop trigger if exists trg_validar_zona_horaria on public.sucursales;
create trigger trg_validar_zona_horaria
  before insert or update of zona_horaria on public.sucursales
  for each row execute function public.validar_zona_horaria();

-- ---------------------------------------------------------------------------
-- Resolver la zona horaria de un empleado
-- ---------------------------------------------------------------------------

/**
 * La zona horaria de la clínica donde trabaja alguien, o Monterrey si no se puede resolver.
 *
 * El fallback NO es un detalle: un empleado sin sucursal asignada, o con el nombre mal escrito,
 * tiene que poder fichar igual. Quedarse sin zona horaria no puede dejar a nadie en la puerta —
 * es la misma regla que ya rige el GPS y el cotejo en este módulo.
 */
create or replace function public.zona_horaria_empleado(p_empleado_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select s.zona_horaria
       from public.usuarios u
       join public.sucursales s on s.nombre = u.sucursal
      where u.id = p_empleado_id
      limit 1),
    'America/Monterrey'
  );
$$;

revoke all on function public.zona_horaria_empleado(uuid) from public;
grant execute on function public.zona_horaria_empleado(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- registrar_checada: la zona horaria sale de la sucursal, no de una constante
-- ---------------------------------------------------------------------------
--
-- Es la MISMA función de antes con dos cambios: c_tz pasa de constante a variable, y la
-- sucursal se resuelve al principio (antes se buscaba a mitad, después de haber calculado ya
-- la fecha con la zona equivocada). Todo lo demás —el candado por empleado, los 90 segundos,
-- la jornada mínima, la encuesta del sábado, el aviso de salida anticipada— queda igual.

create or replace function public.registrar_checada(
  p_empleado_id uuid,
  p_tipo tipo_checada,
  p_lat numeric default null,
  p_lng numeric default null,
  p_precision integer default null,
  p_selfie_path text default null,
  p_device_id text default null
)
returns public.asistencias
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

-- ---------------------------------------------------------------------------
-- Turno automático al dar de alta a alguien
-- ---------------------------------------------------------------------------

-- Sin esta restricción, dos filas para el mismo día son posibles y el cliente se queda con una
-- en silencio (construirDias indexa por día en un Map). Hoy no hay ninguna duplicada —
-- comprobado— así que es el momento de impedirlo, justo cuando empieza a haber un escritor
-- automático de esta tabla.
create unique index if not exists idx_horarios_empleado_dia
  on public.horarios (empleado_id, dia_semana);

/**
 * El turno estándar de la clínica: lunes a viernes 10:00-19:00 y sábado 10:00-14:00, con 10
 * minutos de tolerancia. Es el que tienen las 26 sucursales sin excepción.
 *
 * Las horas son LOCALES de cada clínica, así que aquí no hay nada que convertir: la hora de
 * entrada de Hermosillo son las 10:00 de Hermosillo. La zona horaria solo entra en juego al
 * comparar la hora del turno contra la checada, y eso lo hace quien lee.
 */
create or replace function public.crear_turno_estandar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.horarios (empleado_id, dia_semana, hora_entrada, hora_salida, tolerancia_min)
  select new.id, d, '10:00:00'::time,
         case when d = 6 then '14:00:00'::time else '19:00:00'::time end,
         10
    from generate_series(1, 6) d
  on conflict (empleado_id, dia_semana) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_crear_turno_estandar on public.usuarios;
create trigger trg_crear_turno_estandar
  after insert on public.usuarios
  for each row execute function public.crear_turno_estandar();

comment on function public.crear_turno_estandar() is
  'Da el turno estándar a quien se acaba de dar de alta. Existe porque 8 personas creadas '
  'despues de la carga masiva de julio se quedaron sin horario, y un dia sin horario es '
  'DESCANSO: sus jornadas reales no contaban ni podian generar retardo o falta. RH puede '
  'editarlos o borrarlos despues como siempre.';
