-- ============================================================================
-- 165 — Fichar sin internet: la checada la acepta el servidor con la hora que AFIRMA el
-- dispositivo, y queda marcada hasta que el cotejo facial se pueda hacer.
--
-- Prepara el terreno para la app nativa de Android (ver plans/plan-apps-nativas.md §5.3). La
-- PWA no cambia: el camino en línea se comporta EXACTAMENTE igual que hoy.
--
-- EL PROBLEMA QUE RESUELVE, y no es el que parece. Fichar sin señal no solo aplaza la hora:
-- aplaza el RECONOCIMIENTO FACIAL, que hoy es el control antifraude principal de la asistencia
-- y que vive en el servidor (dos inferencias en api/checar.js, bloqueantes — si la cara no
-- coincide, no hay checada). Sin red no hay modelos que consultar.
--
-- DECISIÓN DEL DUEÑO (2026-09-17): se acepta el fichaje offline, se guarda la selfie, y el
-- cotejo se hace AL RECONECTAR. Mientras tanto la checada existe pero queda
-- `pendiente_validacion`, y la app le dice a la persona «pendiente de validación», nunca
-- «listo». Así el candado facial se conserva entero —solo se retrasa— y nadie se va a casa
-- creyendo que fichó cuando su cotejo va a fallar.
--
-- LA HORA ES UN PROBLEMA DE CONFIANZA, NO DE ALMACENAMIENTO. La hora de un teléfono se cambia
-- en dos toques, y esto alimenta la nómina. Por eso se guardan LAS DOS —la que afirma el
-- dispositivo y la de recepción en el servidor— y su diferencia, para que RH pueda mirar.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Las columnas del sello de confianza.
-- ----------------------------------------------------------------------------

alter table public.asistencias
  add column if not exists origen_offline boolean not null default false,
  -- Cuándo dice el dispositivo que ocurrió. Es `marcada_en` quien manda para las reglas de
  -- negocio; esta columna existe para poder COMPARAR y detectar una hora inventada.
  add column if not exists hora_dispositivo timestamptz,
  -- Cuándo llegó de verdad al servidor. Esta no la puede tocar nadie desde fuera.
  add column if not exists hora_servidor timestamptz,
  -- Diferencia en segundos. Se guarda calculada para que RH pueda ordenar y filtrar sin hacer
  -- aritmética de fechas en cada consulta.
  add column if not exists desfase_segundos integer,
  -- Mientras sea true, el cotejo facial NO se ha hecho. Es lo que separa «fichaste» de
  -- «tenemos tu fichaje y falta comprobarlo».
  add column if not exists pendiente_validacion boolean not null default false,
  -- El uuid que genera EL DISPOSITIVO. Es la pieza anti-duplicado (ver punto 2).
  add column if not exists id_cliente uuid;

-- LA RESTRICCIÓN QUE EVITA COBRAR DOS VECES. Si la red se corta después de enviar pero antes
-- de recibir la respuesta, el teléfono reintenta con el MISMO uuid y este índice hace que el
-- segundo no entre. Sin esto, un corte en el momento justo convierte un fichaje en dos.
--
-- Es parcial (`where id_cliente is not null`) para no estorbar a las checadas de la PWA y a las
-- que RH registra a mano, que no traen uuid y deben poder ser muchas con el valor nulo.
create unique index if not exists asistencias_id_cliente_uniq
  on public.asistencias (id_cliente) where id_cliente is not null;

create index if not exists asistencias_pendientes_validacion
  on public.asistencias (pendiente_validacion) where pendiente_validacion;

comment on column public.asistencias.hora_dispositivo is
  'Hora que AFIRMA el teléfono. No es de fiar por sí sola: el reloj de un móvil se cambia en dos toques.';
comment on column public.asistencias.desfase_segundos is
  'hora_servidor - hora_dispositivo. Un desfase que no se explique por una ventana sin señal plausible es lo que RH debe mirar.';

-- ----------------------------------------------------------------------------
-- 2. `registrar_checada`, con dos parámetros nuevos y NINGÚN cambio para el camino en línea.
--
-- ⚠️ Se recrea a partir de la definición VIVA en producción, no de un archivo del repo. Todo lo
-- que había sigue: el advisory lock por empleado, la zona horaria por sucursal, el guard de 90
-- segundos, el de la encuesta del viernes, el de salida sin entrada, la entrada libre CON su
-- hora aleatoria (mig. 137), el enforcement del módulo de checador (144) y el de rol (148).
--
-- LOS DOS PARÁMETROS SON OPCIONALES Y CON DEFAULT NULL, así que todas las llamadas actuales
-- —api/checar.js, RH registrando a mano— siguen compilando y comportándose igual. Cuando
-- `p_ocurrido_en` es null, la función hace literalmente lo de hoy.
-- ----------------------------------------------------------------------------

-- La ventana hacia atrás que se acepta. Más allá, la checada no entra: una jornada de hace
-- tres días no es «se me fue el internet», es otra cosa, y para eso está RH registrando a mano.
-- 48 horas cubre un fin de semana sin señal en una clínica con el router caído.
--
-- Hacia ADELANTE no se acepta nada más que un minuto de holgura por relojes ligeramente
-- adelantados: una checada del futuro es siempre un reloj manipulado.

create or replace function public.registrar_checada_offline_valida(
  p_ocurrido_en timestamptz,
  out ok boolean,
  out motivo text
)
language plpgsql
-- STABLE y no IMMUTABLE, aunque a primera vista lo parezca: la función usa `now()`, y una
-- función marcada immutable puede ser plegada a una constante por el planificador. Con eso, la
-- ventana de 48 horas se evaluaría contra una hora congelada y dejaría de significar nada.
stable
as $$
begin
  if p_ocurrido_en is null then
    ok := true; return;
  end if;
  if p_ocurrido_en > now() + interval '1 minute' then
    ok := false;
    motivo := 'La hora de tu teléfono está adelantada. Ajústala y vuelve a intentarlo.';
    return;
  end if;
  if p_ocurrido_en < now() - interval '48 hours' then
    ok := false;
    motivo := 'Este registro es de hace más de 48 horas. Pídele a Recursos Humanos que lo capture.';
    return;
  end if;
  ok := true;
end;
$$;

-- La función, recreada a partir de la DEFINICIÓN VIVA EN PRODUCCIÓN (`pg_get_functiondef`), con
-- siete ediciones quirúrgicas y ninguna más.
--
-- ⚠️ NO se parte de un archivo del repo, y hay un motivo aprendido a golpes: una primera versión
-- de esta migración se construyó sobre la 136 y habría BORRADO tres cosas vivas — la hora
-- aleatoria de la entrada libre (137), el enforcement del módulo de checador (144) y el de rol
-- (148). El repo y la VPS llevan meses divergiendo, así que para recrear una función la fuente
-- de verdad es la base, no el archivo.
--
--   1. dos parámetros nuevos, ambos con default null
--   2. variables de apoyo
--   3. idempotencia por `id_cliente` y límites de la hora afirmada
--   4. las tres variables de hora salen del momento EFECTIVO, no de now()
--   5. el guard de 90 s compara contra ese mismo momento
--   6-7. el INSERT guarda el sello

-- ⚠️ SE BORRA LA FIRMA ANTERIOR PRIMERO, Y NO ES OPCIONAL.
--
-- PostgreSQL identifica una función por nombre MÁS tipos de argumentos, así que un
-- `create or replace` con dos parámetros nuevos NO reemplaza: crea una SOBRECARGA. Quedarían
-- dos `registrar_checada`, la de 8 y la de 10, y como todas las de más son opcionales, la
-- llamada de api/checar.js —que pasa menos de 9— sería AMBIGUA: «function is not unique», y el
-- fichaje de toda la plantilla caído.
--
-- Esto no es teoría: el ensayo de esta migración contra la base real devolvió las dos firmas
-- antes de añadir este drop.
drop function if exists public.registrar_checada(
  uuid, tipo_checada, numeric, numeric, integer, text, text, boolean
);

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

  -- Idempotencia (mig. 165): un reintento tras un corte de red DEVUELVE la fila que ya existe
  -- en vez de lanzar. Reintentar tiene que ser inofensivo, o la app no sabria distinguir
  -- «ya estaba» de «fallo» y lo reencolaria para siempre.
  if p_id_cliente is not null then
    select * into v_existente from public.asistencias where id_cliente = p_id_cliente;
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

  if found and v_ultima.marcada_en > v_momento - interval '90 seconds' then
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
    -- Offline entra PENDIENTE: el cotejo facial no se pudo hacer sin red.
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
-- VERIFICACIÓN: ver plan — probado en transacción con rollback contra la base real
-- antes de aplicar, con una cuenta con horario conocido.
-- ----------------------------------------------------------------------------

-- ⚠️ RESTAURAR LA REVOCACIÓN, porque arriba se hizo DROP y eso destruye la ACL.
--
-- Sin estas dos líneas esta migración REABRIRÍA el agujero que cierra la 166: `registrar_checada`
-- volvería a ser llamable desde el navegador, y con ella se saltan la geocerca y el cotejo
-- facial, que viven en api/checar.js y no dentro de la RPC.
--
-- Es la tercera vez hoy que un DROP se lleva por delante unos permisos (la vista del directorio
-- en la 164, esta función en la 166, y esta misma migración si faltara esto).
revoke all on function public.registrar_checada(
  uuid, public.tipo_checada, numeric, numeric, integer, text, text, boolean,
  timestamptz, uuid
) from public, anon, authenticated;

grant execute on function public.registrar_checada(
  uuid, public.tipo_checada, numeric, numeric, integer, text, text, boolean,
  timestamptz, uuid
) to service_role;

commit;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (en transacción con ROLLBACK):
--
--   EL CAMINO EN LÍNEA NO CAMBIA — es lo primero que hay que comprobar:
--     1) registrar_checada(<empleado>, 'entrada')  sin los parámetros nuevos
--        -> se comporta EXACTAMENTE como antes: hora del servidor, origen_offline = false,
--           pendiente_validacion = false, id_cliente null.
--     2) Repetirla dentro de 90 s -> sigue fallando con «Ya registraste tu entrada…».
--     3) Un viernes sin encuesta -> sigue bloqueando la entrada.
--
--   EL CAMINO OFFLINE:
--     4) registrar_checada(..., p_ocurrido_en => now() - interval '3 hours',
--                               p_id_cliente => gen_random_uuid())
--        -> entra; marcada_en = la hora afirmada; hora_servidor = now();
--           desfase_segundos ≈ 10800; origen_offline y pendiente_validacion en true.
--     5) MISMO p_id_cliente otra vez -> NO crea una segunda fila (índice único).
--        Es el caso del reintento tras un corte de red: tiene que ser inofensivo.
--     6) p_ocurrido_en en el futuro (+10 min) -> DEBE FALLAR.
--     7) p_ocurrido_en de hace 3 días        -> DEBE FALLAR con el mensaje de RH.
--
--   LO QUE NO SE PUDO ROMPER:
--     8) Dos transacciones simultáneas con el mismo empleado -> el advisory lock las serializa
--        (guard de la migración 144, que sigue en pie).
--
-- ROLLBACK:
--   drop index if exists asistencias_id_cliente_uniq;
--   drop index if exists asistencias_pendientes_validacion;
--   alter table public.asistencias
--     drop column origen_offline, drop column hora_dispositivo, drop column hora_servidor,
--     drop column desfase_segundos, drop column pendiente_validacion, drop column id_cliente;
--   drop function if exists public.registrar_checada_offline_valida(timestamptz);
--   -- y restaurar registrar_checada() desde la migración 136.
-- ----------------------------------------------------------------------------
