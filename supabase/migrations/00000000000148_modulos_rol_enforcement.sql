-- ============================================================================
-- Enforcement real del interruptor por rol — SOLO en los 7 ítems que ya tenían
-- candado (los 6 módulos de la mig. 141-144 + Checador). El resto de los ~125
-- ítems de navItems.js quedan para cuando se pida auditar cada uno (documentado
-- en el plan de esta feature) — apagarlos ahí solo esconde el menú, no es un
-- candado nuevo.
--
-- ALTER POLICY en vez de drop+create: mismas 6 policies restrictive de la
-- migración 143, se les agrega un AND más sin tocar nada de lo que ya tenían.
-- ============================================================================

alter policy comisiones_modulo_activo on public.comisiones
  using (
    coalesce((select puede_ver_comisiones from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'comisiones'), true)
  );

alter policy comisiones_obj_modulo_activo on storage.objects
  using (
    bucket_id <> 'comisiones'
    or (
      coalesce((select puede_ver_comisiones from public.usuarios where id = public.current_usuario_id()), true)
      and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'comisiones'), true)
    )
  );

alter policy notas_modulo_activo on public.notas
  using (
    coalesce((select puede_usar_notas from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'notas'), true)
  );

alter policy nota_links_modulo_activo on public.nota_links
  using (
    coalesce((select puede_usar_notas from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'notas'), true)
  );

alter policy departamentos_modulo_activo on public.departamentos
  using (
    coalesce((select puede_ver_departamentos from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'departamentos'), true)
  );

alter policy departamento_miembros_modulo_activo on public.departamento_miembros
  using (
    coalesce((select puede_ver_departamentos from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'departamentos'), true)
  );

alter policy departamento_publicaciones_modulo_activo on public.departamento_publicaciones
  using (
    coalesce((select puede_ver_departamentos from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'departamentos'), true)
  );

alter policy departamento_tareas_modulo_activo on public.departamento_tareas
  using (
    coalesce((select puede_ver_departamentos from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'departamentos'), true)
  );

alter policy avisos_modulo_activo on public.avisos
  using (
    coalesce((select puede_ver_avisos from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role() and item_key = 'avisos'), true)
  );

-- OJO: la clave del ítem en navItems.js NO es la misma en los 5 roles — admin/rh/psicologa/
-- admin_plus la ven como "encuestas" (panel de gestión, plural) y empleado/doctor como
-- "encuesta" (su propia encuesta, singular). Sin este case, apagarle "Mi Encuesta" a
-- empleado desde la barra de Admin+ no haría nada (buscaría la fila con la clave equivocada).
alter policy encuestas_modulo_activo on public.encuestas
  using (
    coalesce((select puede_ver_encuestas from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role()
      and item_key = case when public.current_role() in ('empleado', 'doctor') then 'encuesta' else 'encuestas' end), true)
  );

alter policy encuestas_modulo_activo_insert on public.encuestas
  with check (
    coalesce((select puede_ver_encuestas from public.usuarios where id = public.current_usuario_id()), true)
    and coalesce((select activo from public.modulos_rol where role = public.current_role()
      and item_key = case when public.current_role() in ('empleado', 'doctor') then 'encuesta' else 'encuestas' end), true)
  );

-- Checador: mismo motivo que la 144 (registrar_checada es SECURITY DEFINER, no
-- pasa por RLS de asistencias) — el chequeo de rol vive dentro de la función,
-- junto al de persona que ya tiene. Mismo cuerpo que la 144, un AND más.
create or replace function public.registrar_checada(
  p_empleado_id uuid,
  p_tipo tipo_checada,
  p_lat numeric default null::numeric,
  p_lng numeric default null::numeric,
  p_precision integer default null::integer,
  p_selfie_path text default null::text,
  p_device_id text default null::text,
  p_entrada_libre boolean default false
)
returns asistencias
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c_jornada_minima constant interval := interval '30 minutes';
  c_tolerancia     constant interval := interval '30 minutes'; -- gracia para el aviso de salida
  c_ventana_libre  constant interval := interval '30 minutes'; -- entrada libre: hasta 30 min antes del turno

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

  -- La sucursal PRIMERO: de ella sale la zona horaria, y de la zona horaria sale en qué día
  -- natural cae esta checada. Antes esto se resolvía más abajo y la fecha ya se había
  -- calculado con Monterrey — que para Hermosillo y Reynosa es la hora de otro sitio.
  select u.sucursal into v_nombre_suc from public.usuarios u where u.id = p_empleado_id;
  select * into v_sucursal from public.sucursales s
   where s.nombre = v_nombre_suc and s.activa = true;

  v_tz := coalesce(v_sucursal.zona_horaria, 'America/Monterrey');

  v_fecha      := (now() at time zone v_tz)::date;
  v_hora_local := (now() at time zone v_tz)::time;
  v_marcada_en := now();

  select * into v_ultima
  from public.asistencias
  where empleado_id = p_empleado_id and tipo = p_tipo and anulada = false
  order by marcada_en desc
  limit 1;

  if found and v_ultima.marcada_en > now() - interval '90 seconds' then
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

  -- Entrada libre (mig. 135/136/137): con el permiso Y el interruptor prendido para ESTA
  -- checada, la hora que se guarda pasa a ser aleatoria dentro de los 30 minutos antes del
  -- turno (nunca justo la exacta, nunca después) — retardo nunca se guarda como columna,
  -- se calcula al leer comparando marcada_en contra horarios.hora_entrada (ver
  -- src/utils/asistencia.js), así que esto basta para que cualquier pantalla la vea
  -- puntual sin tocar esa lógica en más de un sitio. Sin horario para hoy no hay a qué
  -- hora "ser puntual": se ignora el flag y se guarda la hora real, no revienta.
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
                         - (floor(random() * 31)::int || ' minutes')::interval;
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

    if now() < v_entrada_en + c_jornada_minima then
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
  from public.sucursal_para_checada(p_empleado_id, p_lat, p_lng, p_precision, p_tipo, p_entrada_libre) v;

  insert into public.asistencias (
    empleado_id, tipo, fecha, marcada_en,
    lat, lng, precision_m,
    sucursal_id, distancia_m, ubicacion_estado,
    selfie_path, origen, device_id, dispositivo_nuevo
  ) values (
    p_empleado_id, p_tipo, v_fecha, v_marcada_en,
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
    where coalesce(u.inactivo, false) = false and u.role in ('rh', 'admin', 'admin_plus', 'psicologa');
  end if;

  return v_fila;
end;
$function$;
