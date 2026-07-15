-- ============================================================================
-- SEED DE DESARROLLO LOCAL. Nunca se ejecuta en producción.
--
-- Supabase CLI aplica este archivo automáticamente al final de `supabase db reset`,
-- que solo actúa sobre la base local en Docker. No forma parte de las migraciones y
-- `supabase db push` NO lo sube.
--
-- Hace tres cosas:
--   1. Los GRANTS que faltan (ver "Deuda conocida" en openwiki/modelo-de-datos.md).
--   2. Usuarios de prueba con los 4 roles.
--   3. Horarios y un mes de checadas ya pobladas, para poder mirar los reportes sin
--      tener que fichar a mano treinta veces.
--
-- Todos los datos son inventados. Nada de PII real (misma regla que en los tests).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GRANTS
--
-- Las migraciones corren como `postgres`, cuyo default privilege en Supabase NO
-- incluye select/insert/update (solo lo tiene supabase_admin). En producción los
-- grants llegaron por la configuración inicial del proyecto; en una base
-- reconstruida desde el repo NO existen, y la app responde "permission denied" a
-- todo, sin que RLS llegue siquiera a evaluarse.
--
-- Esto lo emula para poder desarrollar en local. NO sustituye a arreglarlo de
-- verdad con una migración: mientras esto viva solo aquí, la base sigue sin poder
-- reconstruirse desde el repositorio.
--
-- Conceder el privilegio no es conceder el acceso: quién ve qué lo siguen decidiendo
-- las policies de RLS.
-- ----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tablename);
    -- service_role también: se salta RLS, pero NO los privilegios de tabla. Sin este grant,
    -- las funciones serverless (cotejo facial) reciben "permission denied".
    execute format('grant select, insert, update, delete on public.%I to service_role', t.tablename);
  end loop;
end $$;

grant usage on schema public to authenticated, anon, service_role;


-- ----------------------------------------------------------------------------
-- 2. USUARIOS DE PRUEBA
--
-- Contraseña de todos: prueba1234
-- Login por username (la app lo convierte a <username>@mcdental.internal).
--
-- A propósito NO se usa la contraseña temporal (emp123): entrar con ella dispara el
-- cambio de contraseña forzado y no dejaría llegar al checador. `debe_cambiar_password`
-- va en false por lo mismo.
-- ----------------------------------------------------------------------------
do $$
declare
  u        record;
  v_email  text;
begin
  for u in
    select * from (values
      ('a0000000-0000-0000-0000-000000000001'::uuid, 'aa000000-0000-0000-0000-000000000001'::uuid, 'admin', 'Admin de Prueba',     'admin'::public.rol_usuario,     'Oficina Administrativa'),
      ('a0000000-0000-0000-0000-000000000002'::uuid, 'aa000000-0000-0000-0000-000000000002'::uuid, 'rh',    'RH de Prueba',        'rh'::public.rol_usuario,        'Oficina Administrativa'),
      ('a0000000-0000-0000-0000-000000000003'::uuid, 'aa000000-0000-0000-0000-000000000003'::uuid, 'psico', 'Psicóloga de Prueba', 'psicologa'::public.rol_usuario, 'Oficina Administrativa'),
      ('a0000000-0000-0000-0000-000000000004'::uuid, 'aa000000-0000-0000-0000-000000000004'::uuid, 'ana',   'Ana Puntual',         'empleado'::public.rol_usuario,  'McDental Palmas'),
      ('a0000000-0000-0000-0000-000000000005'::uuid, 'aa000000-0000-0000-0000-000000000005'::uuid, 'beto',  'Beto Impuntual',      'empleado'::public.rol_usuario,  'McDental Palmas'),
      ('a0000000-0000-0000-0000-000000000006'::uuid, 'aa000000-0000-0000-0000-000000000006'::uuid, 'caro',  'Caro Sin Turno',      'empleado'::public.rol_usuario,  'McDental Tuxpan')
    ) as t(uuid_auth, uuid_perfil, username, nombre, rol, sucursal)
  loop
    v_email := u.username || '@mcdental.internal';

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.uuid_auth, 'authenticated', 'authenticated',
      v_email, crypt('prueba1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      -- Cadenas vacías, NO null: GoTrue lee estas columnas al iniciar sesión y un null
      -- revienta con "Database error querying schema", que no dice absolutamente nada.
      '', '', '', ''
    ) on conflict (id) do nothing;

    -- GoTrue exige una identity para el proveedor 'email'. Sin ella el login falla
    -- aunque la fila de auth.users sea perfecta.
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      u.uuid_auth::text, u.uuid_auth,
      format('{"sub":"%s","email":"%s","email_verified":true}', u.uuid_auth, v_email)::jsonb,
      'email', now(), now(), now()
    ) on conflict (provider, provider_id) do nothing;

    insert into public.usuarios (
      id, auth_user_id, name, username, synthetic_email, role, sucursal, puesto,
      fecha_ingreso, debe_cambiar_password
    ) values (
      u.uuid_perfil, u.uuid_auth, u.nombre, u.username, v_email, u.rol, u.sucursal,
      'Puesto de prueba', current_date - interval '2 years', false
    ) on conflict (id) do nothing;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 3. HORARIOS
--
-- Ana y Beto: lunes a viernes de 10 a 19 (tolerancia 15 min) y sábado corto de 10 a 14.
-- Caro se queda SIN horarios a propósito: sirve para comprobar que un empleado sin
-- turno sale como "descanso" todos los días y no como una montaña de faltas.
-- ----------------------------------------------------------------------------
insert into public.horarios (empleado_id, dia_semana, hora_entrada, hora_salida, tolerancia_min)
select u.id, d.dia, '10:00'::time, case when d.dia = 6 then '14:00'::time else '19:00'::time end, 15
from public.usuarios u
cross join (select generate_series(1, 6) as dia) d
where u.username in ('ana', 'beto')
on conflict (empleado_id, dia_semana) do nothing;


-- ----------------------------------------------------------------------------
-- 4. HISTORIAL DE CHECADAS (los últimos 30 días)
--
-- Se insertan directamente (no por la RPC) porque son datos del pasado y la RPC
-- —con razón— siempre pone la hora actual.
--
-- Ana llega puntual. Beto llega tarde los lunes y un día no aparece: así el panel de
-- RH tiene retardos y faltas de verdad que enseñar, y los cuatro cortes del historial
-- (día/semana/mes/año) tienen algo dentro desde el primer momento.
-- ----------------------------------------------------------------------------
do $$
declare
  c_tz constant text := 'America/Monterrey';
  v_ana  uuid := (select id from public.usuarios where username = 'ana');
  v_beto uuid := (select id from public.usuarios where username = 'beto');
  v_suc  uuid := (select id from public.sucursales where nombre = 'McDental Palmas');
  v_dia  date;
  v_iso  int;
  v_entrada_ana  time;
  v_entrada_beto time;
begin
  for v_dia in
    select generate_series(current_date - 30, current_date - 1, interval '1 day')::date
  loop
    v_iso := extract(isodow from v_dia);
    continue when v_iso = 7;  -- domingo: no hay turno

    -- Ana: siempre a tiempo (entre 8:52 y 9:04).
    v_entrada_ana := '09:52'::time + (floor(random() * 12) || ' minutes')::interval;
    insert into public.asistencias (empleado_id, tipo, fecha, marcada_en, lat, lng, precision_m, sucursal_id, distancia_m, ubicacion_estado)
    values
      (v_ana, 'entrada', v_dia, (v_dia + v_entrada_ana) at time zone c_tz, 22.2331, -97.8611, 12, v_suc, 8, 'dentro'),
      (v_ana, 'salida',  v_dia, (v_dia + case when v_iso = 6 then '14:05'::time else '19:07'::time end) at time zone c_tz, 22.2331, -97.8611, 14, v_suc, 11, 'dentro');

    -- Beto: los lunes llega tarde de verdad; el resto de días, justo.
    -- Y un martes de hace un par de semanas, sencillamente no vino (una falta limpia).
    -- La ventana de 8 días garantiza que caiga exactamente un martes, sea cual sea el
    -- día en que se ejecute el seed.
    continue when v_iso = 2 and v_dia > current_date - 14 and v_dia < current_date - 6;

    v_entrada_beto := case when v_iso = 1 then '10:26'::time else '10:06'::time end;
    insert into public.asistencias (empleado_id, tipo, fecha, marcada_en, lat, lng, precision_m, sucursal_id, distancia_m, ubicacion_estado)
    values
      (v_beto, 'entrada', v_dia, (v_dia + v_entrada_beto) at time zone c_tz, 22.2331, -97.8611, 18, v_suc, 22, 'dentro'),
      (v_beto, 'salida',  v_dia, (v_dia + case when v_iso = 6 then '14:00'::time else '19:02'::time end) at time zone c_tz, 22.2331, -97.8611, 20, v_suc, 25, 'dentro');
  end loop;

  -- Una checada FUERA de la geocerca y otra SIN GPS, para que la sección "requieren
  -- revisión" del panel de RH no salga vacía — que es justo la parte que hay que mirar.
  insert into public.asistencias (empleado_id, tipo, fecha, marcada_en, lat, lng, precision_m, sucursal_id, distancia_m, ubicacion_estado)
  values
    (v_beto, 'entrada', current_date - 2, ((current_date - 2) + '10:03'::time) at time zone c_tz, 22.3000, -97.9000, 25, v_suc, 8448, 'fuera'),
    (v_ana,  'salida',  current_date - 3, ((current_date - 3) + '19:10'::time) at time zone c_tz, null, null, null, v_suc, null, 'sin_gps');
end $$;

-- ----------------------------------------------------------------------------
-- La geocerca de McDental Palmas se deja SIN configurar (lat/lng en null), igual que
-- llega de la migración 34. Configurarla es parte de lo que hay que probar:
-- Admin -> Sucursales -> "Usar mi ubicación actual".
-- ----------------------------------------------------------------------------
