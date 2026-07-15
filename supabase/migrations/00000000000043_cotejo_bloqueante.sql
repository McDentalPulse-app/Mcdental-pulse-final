-- ============================================================================
-- El cotejo facial pasa a BLOQUEAR: si la cara no coincide, no hay checada.
--
-- LO QUE ESTO OBLIGA A CAMBIAR, Y POR QUÉ NO ERA OPCIONAL:
--
-- Hasta ahora el empleado llamaba a registrar_checada() directamente desde el navegador, y
-- el cotejo corría DESPUÉS, marcando la checada ya creada. Mientras solo marcaba, daba
-- igual. Para bloquear, ya no: cualquiera abriría la consola del navegador, llamaría a la
-- RPC a mano y se saltaría el cotejo entero con dos líneas.
--
-- Así que el único camino para crear una checada pasa a ser la función serverless
-- (api/checar.js), que coteja ANTES de registrar. Para que eso se pueda imponer de verdad:
--
--   - registrar_checada() ya NO la puede ejecutar el rol `authenticated`. Solo la service
--     role, que vive únicamente en el servidor.
--   - Como la service role no tiene identidad (auth.uid() es null), la función recibe el
--     empleado como parámetro. Ese id NO viene del cliente: lo saca el servidor del JWT que
--     acaba de verificar. El cliente sigue sin poder decir "soy otro".
--
-- Todos los guardias anteriores (hora del servidor, geocerca, anti doble-clic, ventana de
-- salida, dispositivo) se quedan exactamente donde estaban.
--
-- LA VÁLVULA DE ESCAPE, Y POR QUÉ ES OBLIGATORIA:
--
-- "Bloquear hasta que coincida" suena razonable hasta que le toca a alguien con gafas
-- nuevas, a contraluz o con barba de tres días. Esa persona no podría fichar NUNCA, y
-- tampoco podría arreglarlo sola: su registro está aprobado y cerrado. Sería un empleado
-- que no puede trabajar por culpa de un modelo que tuvo un mal día.
--
-- Por eso, tras varios intentos fallidos seguidos, la checada se registra igual — pero
-- MARCADA como no verificada, y RH la ve. El impostor terco también entra por ahí, sí: la
-- diferencia es que entra señalado con un cartel, en vez de entrar como si nada. Se cambia
-- "nadie pasa" por "nadie pasa sin dejar rastro", que es lo máximo que se puede prometer
-- sin dejar gente tirada en la puerta a las ocho de la mañana.
-- ============================================================================

-- ¿Usa lentes? Si los usa, en el registro se le piden fotos CON y SIN, para que el cotejo
-- lo reconozca en los dos casos. Es la causa número uno de falso rechazo.
alter table public.rostros
  add column if not exists usa_lentes boolean not null default false;

comment on column public.rostros.usa_lentes is
  'true = en el registro se tomaron fotos con y sin lentes. El cotejo compara contra todas y se queda con el mejor parecido, así que reconoce a la persona lleve o no lleve las gafas puestas.';


-- Intentos fallidos de cotejo. Sirven para la válvula de escape: sin memoria entre
-- llamadas (la función es serverless), el contador tiene que vivir en la base.
create table if not exists public.cotejo_intentos (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.usuarios(id) on delete cascade,
  score       real,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_cotejo_intentos_empleado
  on public.cotejo_intentos (empleado_id, creado_en desc);

comment on table public.cotejo_intentos is
  'Intentos de checada en los que la cara no coincidió. Solo los escribe api/checar.js. Tras N fallos seguidos se deja pasar la checada MARCADA, para no dejar a nadie sin poder fichar. Ver migración 043.';

alter table public.cotejo_intentos enable row level security;

-- Nadie los lee ni los escribe desde el navegador. Si el empleado pudiera borrarlos, se
-- reiniciaría el contador y tendría intentos infinitos para colar una cara ajena.
grant select, insert, delete on public.cotejo_intentos to service_role;

drop policy if exists cotejo_intentos_select_admin_rh on public.cotejo_intentos;
create policy cotejo_intentos_select_admin_rh
  on public.cotejo_intentos for select
  using ((select public.current_role()) in ('admin', 'rh'));


-- ----------------------------------------------------------------------------
-- registrar_checada(): ahora recibe el empleado y solo la puede llamar el servidor.
-- ----------------------------------------------------------------------------
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
  if p_empleado_id is null then
    raise exception 'No autenticado.';
  end if;

  -- Serializa las checadas de ESTE usuario dentro de la transacción: un doble toque en el
  -- botón, o un móvil con red lenta que reintenta, podría meter dos entradas simultáneas.
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

    select h.hora_salida into v_hora_salida
    from public.horarios h
    where h.empleado_id = p_empleado_id
      and h.dia_semana = extract(isodow from v_fecha);

    if v_hora_salida is not null and v_hora_local < (v_hora_salida - c_margen_salida) then
      raise exception
        'Todavía no puedes registrar tu salida. Tu turno termina a las %, podrás checar a partir de las %. Si necesitas irte antes, avisa a Recursos Humanos.',
        to_char(v_hora_salida, 'HH24:MI'),
        to_char(v_hora_salida - c_margen_salida, 'HH24:MI');
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
    p_empleado_id, p_tipo, v_fecha, now(),   -- <- hora del SERVIDOR, siempre
    p_lat, p_lng, p_precision,
    v_sucursal.id, v_distancia, v_estado,
    p_selfie_path, 'empleado', p_device_id, v_disp_nuevo
  )
  returning * into v_fila;

  return v_fila;
end;
$$;

-- La versión vieja (sin p_empleado_id) la podía llamar cualquier empleado desde la consola
-- del navegador. Mientras el cotejo solo marcaba, daba igual. Ahora que bloquea, sería la
-- puerta trasera que lo anula entero. Se elimina.
drop function if exists public.registrar_checada(public.tipo_checada, numeric, numeric, integer, text, text);

-- Y la nueva NO se le concede a `authenticated`: el único camino es api/checar.js, que
-- coteja la cara ANTES de llamar aquí.
revoke all on function public.registrar_checada(uuid, public.tipo_checada, numeric, numeric, integer, text, text) from public, anon, authenticated;
grant execute on function public.registrar_checada(uuid, public.tipo_checada, numeric, numeric, integer, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (como empleado, desde el navegador)
--   select * from public.registrar_checada('<mi-id>', 'entrada');
--     -> DEBE FALLAR: permission denied for function registrar_checada.
--        Si esto funcionara, el cotejo facial no bloquearía nada: bastaría con llamar a la
--        RPC a mano y saltárselo.
--
-- ROLLBACK:
--   (reaplicar registrar_checada de la migración 040 y su grant a authenticated)
--   drop table if exists public.cotejo_intentos;
--   alter table public.rostros drop column if exists usa_lentes;
-- ----------------------------------------------------------------------------
