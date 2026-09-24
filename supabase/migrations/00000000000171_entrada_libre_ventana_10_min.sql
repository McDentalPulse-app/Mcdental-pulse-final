-- ============================================================================
-- 171 — Entrada libre: la ventana aleatoria baja de 30 a 10 minutos antes del turno.
--
-- PEDIDO DEL DUEÑO (2026-09-24): con el turno a las 10:00, la hora que se guardaba caía en
-- cualquier punto entre las 9:30 y las 10:00 (migración 137: `floor(random() * 31)` minutos
-- antes, es decir 0 a 30). Se acota a 9:50-10:00 (`floor(random() * 11)`, 0 a 10 minutos
-- antes) — sigue siendo aleatoria y sigue sin caer nunca justo en la hora exacta ni después,
-- solo con una ventana más angosta.
--
-- MISMO CUIDADO QUE LA 165: esta función lleva divergiendo repo/VPS más de una vez, así que
-- NO se parte a ciegas del archivo del repo. Antes de escribir esto se comparó
-- `pg_get_functiondef` de la función VIVA en producción contra `00000000000165_checada_offline.sql`
-- —normalizando solo diferencias de formato (espaciado, `timestamptz` vs `timestamp with time
-- zone`, azúcar de los DEFAULT)— y coinciden byte a byte en contenido real. Se parte de esa
-- base con la certeza de que no hay nada vivo distinto que esta migración vaya a pisar.
--
-- UN SOLO CAMBIO, y ninguno más: el `31` de `floor(random() * 31)` (0 a 30 minutos) pasa a
-- `11` (0 a 10 minutos). Se deja el número mágico igual que estaba —no atado a
-- `c_ventana_libre`— para no meter una fórmula nueva (extract/epoch) en una función que ya
-- tiene fama de divergir entre repo y VPS; menos superficie, menos riesgo. `c_ventana_libre`
-- se actualiza igual a 10 minutos, solo para que el comentario que la declara no mienta.
--
-- SIN DROP: la firma (10 parámetros, mismos tipos) es idéntica a la que ya existe, así que
-- `CREATE OR REPLACE FUNCTION` conserva los permisos ya otorgados (revoke de public/anon/
-- authenticated + grant a service_role, migración 166) sin tocarlos. No hace falta repetirlos.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.registrar_checada(p_empleado_id uuid, p_tipo tipo_checada, p_lat numeric DEFAULT NULL::numeric, p_lng numeric DEFAULT NULL::numeric, p_precision integer DEFAULT NULL::integer, p_selfie_path text DEFAULT NULL::text, p_device_id text DEFAULT NULL::text, p_entrada_libre boolean DEFAULT false, p_ocurrido_en timestamptz DEFAULT NULL, p_id_cliente uuid DEFAULT NULL)
 RETURNS asistencias
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- Anadidos por la migracion 165 (fichaje offline).
  v_momento     timestamptz;  -- el instante que mandan las REGLAS (el afirmado, si es offline)
  v_offline     boolean;
  v_ok          boolean;
  v_motivo      text;
  v_existente   public.asistencias;
  c_jornada_minima constant interval := interval '30 minutes';
  c_tolerancia     constant interval := interval '30 minutes'; -- gracia para el aviso de salida
  -- mig. 171: de 30 a 10 minutos. Sigue sin leerse en el cálculo de abajo —igual que antes—,
  -- se actualiza solo para que el valor declarado coincida con el real (ver el número mágico
  -- `11` unas líneas más abajo).
  c_ventana_libre  constant interval := interval '10 minutes'; -- entrada libre: hasta 10 min antes del turno

  v_tz                 text;
  v_sucursal           public.sucursales%rowtype;
  v_nombre_suc         text;
  v_fecha              date;
  v_hora_local         time;
  v_hora_turno         time;
  v_hora_autorizada    time;
  v_hora_limite        time;
  v_avisar_salida      boolean := false;
  v_sucursal_id        uuid;
  v_distancia          integer;
  v_estado             public.estado_ubicacion;
  v_ultima             public.asistencias%rowtype;
  v_entrada_en         timestamptz;
  v_conocido           boolean;
  v_tenia_alguno       boolean;
  v_disp_nuevo         boolean := false;
  v_fila               public.asistencias%rowtype;
  v_marcada_en         timestamptz;
  v_forzar_libre       boolean := false;
  v_hora_turno_entrada time;
  v_rol_empleado       public.rol_usuario;
begin
  if p_empleado_id is null then
    raise exception 'No autenticado.';
  end if;

  select role into v_rol_empleado from public.usuarios where id = p_empleado_id;

  if not coalesce((select puede_usar_checador from public.usuarios where id = p_empleado_id), true) then
    raise exception 'El módulo de Checador está desactivado para tu cuenta. Contacta a Admin+.';
  end if;

  if not coalesce((select activo from public.modulos_rol where role = v_rol_empleado and item_key = 'checador'), true) then
    raise exception 'El módulo de Checador está desactivado para tu rol. Contacta a Admin+.';
  end if;

  perform pg_advisory_xact_lock(hashtext('checada:' || p_empleado_id::text));

  -- Idempotencia (mig. 165): un reintento tras un corte de red DEVUELVE la fila que ya existe
  -- en vez de lanzar. Reintentar tiene que ser inofensivo, o la app no sabria distinguir
  -- «ya estaba» de «fallo» y lo reencolaria para siempre.
  if p_id_cliente is not null then
    select * into v_existente from public.asistencias
     where id_cliente = p_id_cliente
       and empleado_id = p_empleado_id
       and tipo = p_tipo
       and anulada = false;
    if found then return v_existente; end if;
  end if;

  v_offline := p_ocurrido_en is not null;
  if v_offline then
    select ok, motivo into v_ok, v_motivo from public.registrar_checada_offline_valida(p_ocurrido_en);
    if not v_ok then raise exception '%', v_motivo; end if;
  end if;

  v_momento := coalesce(p_ocurrido_en, now());

  -- La sucursal PRIMERO: de ella sale la zona horaria, y de la zona horaria sale en qué día
  -- natural cae esta checada. Antes esto se resolvía más abajo y la fecha ya se había
  -- calculado con Monterrey — que para Hermosillo y Reynosa es la hora de otro sitio.
  select u.sucursal into v_nombre_suc from public.usuarios u where u.id = p_empleado_id;
  select * into v_sucursal from public.sucursales s
   where s.nombre = v_nombre_suc and s.activa = true;

  v_tz := coalesce(v_sucursal.zona_horaria, 'America/Monterrey');

  -- Las reglas usan el momento en que OCURRIO, no el de llegada: un fichaje de las 8:02
  -- enviado a mediodia debe evaluarse contra el turno de las 8:00.
  v_fecha      := (v_momento at time zone v_tz)::date;
  v_hora_local := (v_momento at time zone v_tz)::time;
  v_marcada_en := v_momento;

  select * into v_ultima
  from public.asistencias
  where empleado_id = p_empleado_id and tipo = p_tipo and anulada = false
  order by marcada_en desc
  limit 1;

  if found and abs(extract(epoch from (v_ultima.marcada_en - v_momento))) < 90 then
    raise exception 'Ya registraste tu % hace unos segundos.', p_tipo;
  end if;

  -- Viernes sin encuesta semanal contestada: no se deja marcar ENTRADA hasta que la conteste
  -- (la salida no se toca). Reemplaza al guard de sábado/salida de las migraciones 082-127.
  if p_tipo = 'entrada' and extract(isodow from v_fecha) = 5 then
    if not exists (
      select 1 from public.encuestas
      where empleado_id = p_empleado_id
        and semana = to_char(v_fecha, 'IYYY-"W"IW')
    ) then
      raise exception 'Antes de marcar tu entrada el viernes, contesta la encuesta semanal.';
    end if;
  end if;

  -- Entrada libre (mig. 135/136/137, ventana ajustada en 171): con el permiso Y el interruptor
  -- prendido para ESTA checada, la hora que se guarda pasa a ser aleatoria dentro de los 10
  -- minutos antes del turno (nunca justo la exacta, nunca después) — retardo nunca se guarda
  -- como columna, se calcula al leer comparando marcada_en contra horarios.hora_entrada (ver
  -- src/utils/asistencia.js), así que esto basta para que cualquier pantalla la vea puntual sin
  -- tocar esa lógica en más de un sitio. Sin horario para hoy no hay a qué hora "ser puntual":
  -- se ignora el flag y se guarda la hora real, no revienta.
  --
  -- floor(random() * 11) da un entero de 0 a 10 (11 valores posibles): con el turno a las
  -- 10:00, cae siempre entre las 9:50 y las 10:00. Antes era `* 31` (0 a 30, o sea 9:30-10:00).
  if p_tipo = 'entrada' and p_entrada_libre then
    select coalesce(u.puede_marcar_entrada_libre, false) into v_forzar_libre
    from public.usuarios u where u.id = p_empleado_id;

    if v_forzar_libre then
      select h.hora_entrada into v_hora_turno_entrada
      from public.horarios h
      where h.empleado_id = p_empleado_id
        and h.dia_semana = extract(isodow from v_fecha);

      if v_hora_turno_entrada is not null then
        v_marcada_en := (v_fecha::text || ' ' || v_hora_turno_entrada::text)::timestamp at time zone v_tz
                         - (floor(random() * 11)::int || ' minutes')::interval;
      else
        v_forzar_libre := false;
      end if;
    end if;
  end if;

  if p_tipo = 'salida' then
    select min(marcada_en) into v_entrada_en
    from public.asistencias
    where empleado_id = p_empleado_id and fecha = v_fecha
      and tipo = 'entrada' and anulada = false;

    if v_entrada_en is null then
      raise exception 'No puedes registrar tu salida: hoy no tienes una entrada registrada.';
    end if;

    if v_momento < v_entrada_en + c_jornada_minima then
      raise exception
        'Acabas de registrar tu entrada. Podrás fichar la salida a partir de las %.',
        to_char((v_entrada_en + c_jornada_minima) at time zone v_tz, 'HH24:MI');
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
  from public.sucursal_para_checada(p_empleado_id, p_lat, p_lng, p_precision, p_tipo, p_entrada_libre) v;

  insert into public.asistencias (
    empleado_id, tipo, fecha, marcada_en,
    lat, lng, precision_m,
    sucursal_id, distancia_m, ubicacion_estado,
    selfie_path, origen, device_id, dispositivo_nuevo,
    origen_offline, hora_dispositivo, hora_servidor, desfase_segundos,
    pendiente_validacion, id_cliente
  ) values (
    p_empleado_id, p_tipo, v_fecha, v_marcada_en,
    p_lat, p_lng, p_precision,
    v_sucursal_id, v_distancia, v_estado,
    p_selfie_path, 'empleado', p_device_id, v_disp_nuevo,
    v_offline,
    case when v_offline then p_ocurrido_en end,
    case when v_offline then now() end,
    case when v_offline then extract(epoch from (now() - p_ocurrido_en))::integer end,
    v_offline,
    p_id_cliente
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
    where coalesce(u.inactivo, false) = false and u.role in ('rh', 'admin', 'admin_plus', 'psicologa');
  end if;

  return v_fila;
end;
$function$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (en transacción con ROLLBACK, contra la base real, con una cuenta con horario
-- conocido — p.ej. entrada a las 10:00):
--
--   1. registrar_checada(<empleado>, 'entrada', p_entrada_libre => true), repetida ~20 veces
--      en la transacción de prueba -> marcada_en cae SIEMPRE entre 9:50:00 y 10:00:00, nunca
--      antes de las 9:50 (a diferencia de antes, que llegaba hasta las 9:30).
--   2. El camino normal (p_entrada_libre => false, o el permiso apagado en `usuarios`) no
--      cambia: se sigue guardando la hora real, igual que con la 165.
--   3. Los permisos (grant/revoke de la 166) siguen intactos tras el CREATE OR REPLACE — se
--      comprueba con information_schema.routine_privileges antes y después de aplicar.
--
-- ROLLBACK: reaplicar el CREATE OR REPLACE de la migración 165 (mismo cuerpo, `c_ventana_libre`
-- en 30 minutos y el cálculo con el número mágico `31`).
-- ----------------------------------------------------------------------------
