-- ============================================================================
-- Catálogo de sucursales con coordenadas (prerequisito de la geocerca del checador).
--
-- Hasta ahora las sucursales solo existían como 25 cadenas de texto en
-- src/utils/constants.js (SUCURSALES) y como texto libre en usuarios.sucursal.
-- Eso basta para agrupar y filtrar, pero no para responder "¿esta persona checó
-- DESDE la clínica?", que necesita un punto y un radio.
--
-- Se siembra con los 25 nombres actuales y las coordenadas en NULL a propósito:
-- nadie tiene hoy la latitud/longitud de las clínicas, y adivinarlas desde un mapa
-- es peor que no tenerlas (una geocerca mal puesta rechaza a quien sí está en su
-- sitio). Se capturan desde la app (Admin -> Sucursales -> "Usar mi ubicación
-- actual"), estando físicamente en cada clínica.
--
-- Una sucursal sin coordenadas simplemente no tiene geocerca: sus checadas quedan
-- con ubicacion_estado = 'sin_geocerca'. Así el checador es útil desde el día 1 y
-- la geocerca se va activando clínica por clínica, sin bloquear el despliegue.
--
-- constants.js sigue siendo la fuente de los NOMBRES (los usan otras pantallas);
-- esta tabla es la fuente de las COORDENADAS.
-- ============================================================================

create table if not exists public.sucursales (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  lat        numeric(9, 6),          -- ~11 cm de resolución; de sobra para un radio en metros
  lng        numeric(9, 6),
  radio_m    integer not null default 150 check (radio_m between 20 and 5000),
  activa     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- O están las dos coordenadas, o no está ninguna. Media coordenada es un dato
  -- corrupto que haría que la distancia saliera de un punto inventado.
  constraint sucursales_coords_completas check (
    (lat is null and lng is null) or (lat is not null and lng is not null)
  )
);

comment on table public.sucursales is
  'Catálogo de clínicas con su geocerca. lat/lng NULL = sin geocerca configurada (las checadas se registran igual, marcadas como sin_geocerca). Ver migración 034.';
comment on column public.sucursales.radio_m is
  'Radio de tolerancia en metros. 150 m por defecto: cubre el error típico de un GPS de móvil en interiores sin dejar que alguien cheque desde la otra cuadra.';

drop trigger if exists trg_sucursales_updated_at on public.sucursales;
create trigger trg_sucursales_updated_at
  before update on public.sucursales
  for each row execute function public.set_updated_at();

-- Siembra: los 25 nombres canónicos de SUCURSALES (src/utils/constants.js).
-- Idempotente: re-ejecutar la migración no duplica ni pisa coordenadas ya capturadas.
insert into public.sucursales (nombre) values
  ('Oficina Administrativa'),
  ('McDental Palmas'),
  ('McDental Madero'),
  ('McDental Tampico'),
  ('McDental Tampico Obregon'),
  ('Popular Tampico'),
  ('McDental Tuxpan'),
  ('Popular Tuxpan'),
  ('McDental Poza Rica'),
  ('Popular Poza Rica'),
  ('McDental Valles'),
  ('McDental Irapuato'),
  ('Popular Irapuato'),
  ('McDental Victoria'),
  ('McDental Reynosa'),
  ('McDental Pachuca'),
  ('McDental Hermosillo'),
  ('McDental Villahermosa'),
  ('McDental Huejutla'),
  ('McDental Altamira'),
  ('McDental Ebano'),
  ('Popular Reynosa'),
  ('McDental Mante'),
  ('McDental Leon'),
  ('Martinez De La Torre')
on conflict (nombre) do nothing;

alter table public.sucursales enable row level security;

-- Grants explícitos: sin esto la tabla da "permission denied" y RLS ni se evalúa.
-- Las migraciones corren como 'postgres', y el default privilege de ese rol en
-- Supabase no incluye SELECT/INSERT/UPDATE (solo lo tiene supabase_admin). Quién
-- puede hacer qué lo siguen decidiendo las policies; el grant solo deja que RLS
-- llegue a opinar.
grant select, insert, update on public.sucursales to authenticated;

-- Lectura: cualquier usuario autenticado. El empleado necesita saber el nombre de su
-- clínica y si tiene geocerca para que el checador le diga qué está pasando.
drop policy if exists sucursales_select_autenticados on public.sucursales;
create policy sucursales_select_autenticados
  on public.sucursales for select
  using ((select public.current_role()) is not null);

-- Escritura: solo admin. Mover una geocerca es mover quién puede checar y desde dónde.
drop policy if exists sucursales_insert_admin on public.sucursales;
create policy sucursales_insert_admin
  on public.sucursales for insert
  with check ((select public.current_role()) = 'admin');

drop policy if exists sucursales_update_admin on public.sucursales;
create policy sucursales_update_admin
  on public.sucursales for update
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

-- Sin policy de DELETE: una sucursal con checadas históricas no se borra, se marca
-- inactiva (activa = false). Igual que el resto de la app, que no borra nada.

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select nombre, lat, lng, radio_m from public.sucursales order by nombre;
--     -> 25 filas, lat/lng en null.
--
--   (como empleado) update public.sucursales set radio_m = 5000;
--     -> 0 filas afectadas (RLS lo bloquea en silencio, no es un error).
--
-- ROLLBACK:
--   drop table if exists public.sucursales;
-- ----------------------------------------------------------------------------
