-- ============================================================================
-- Calendario de festivos + intercambio de días.
--
-- 1) festivos: los días no laborables. Se precargan los de descanso obligatorio de México 2026
--    (LFT art. 74). RH puede agregar/quitar días propios de la empresa después. Todos los
--    usuarios los ven; solo gestión los edita.
--
-- 2) intercambios_dia: un empleado/doctor "aparta" un festivo (fecha_festivo, el día que cede)
--    para cambiarlo por otro día que quiere (fecha_destino). La EXCLUSIVIDAD es sobre el día
--    DESTINO: un solo usuario puede quedarse con esa fecha destino (índice único parcial). Al
--    solicitarlo, RH recibe una notificación y aprueba/rechaza; el solicitante recibe el aviso.
--    Ambas cosas pasan por el servidor (api/solicitar-intercambio.js, api/resolver-intercambio.js)
--    para poder mandar el push con la clave de VAPID.
-- ============================================================================

-- 1) Festivos --------------------------------------------------------------
create table public.festivos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null unique,
  nombre     text not null,
  tipo       text not null default 'oficial',   -- 'oficial' | 'empresa'
  created_at timestamptz not null default now()
);

alter table public.festivos enable row level security;

-- Todos los autenticados ven el calendario.
create policy festivos_select_all on public.festivos
  for select using (auth.uid() is not null);

-- Solo gestión edita (agrega/quita días).
create policy festivos_insert_gestion on public.festivos
  for insert with check ((select public.current_role()) in ('rh', 'admin', 'psicologa'));

create policy festivos_delete_gestion on public.festivos
  for delete using ((select public.current_role()) in ('rh', 'admin', 'psicologa'));

grant select, insert, delete on public.festivos to authenticated;
grant select, insert, update, delete on public.festivos to service_role;

-- Días de descanso obligatorio México 2026 (LFT art. 74). Los que caen en lunes son por la
-- regla del "lunes de descanso" (Constitución = 1er lunes de feb, Juárez = 3er lunes de mar,
-- Revolución = 3er lunes de nov).
insert into public.festivos (fecha, nombre, tipo) values
  ('2026-01-01', 'Año Nuevo', 'oficial'),
  ('2026-02-02', 'Día de la Constitución', 'oficial'),
  ('2026-03-16', 'Natalicio de Benito Juárez', 'oficial'),
  ('2026-05-01', 'Día del Trabajo', 'oficial'),
  ('2026-09-16', 'Independencia de México', 'oficial'),
  ('2026-11-16', 'Revolución Mexicana', 'oficial'),
  ('2026-12-25', 'Navidad', 'oficial')
on conflict (fecha) do nothing;

-- 2) Intercambios de día ---------------------------------------------------
create table public.intercambios_dia (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null references public.usuarios(id) on delete cascade,
  fecha_festivo  date not null,                                    -- el festivo que cede
  fecha_destino  date not null,                                    -- el día que quiere (exclusivo)
  estado         public.estado_solicitud not null default 'pendiente',
  comentario_rh  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_intercambios_updated_at
  before update on public.intercambios_dia
  for each row execute function public.set_updated_at();

create index idx_intercambios_empleado_id on public.intercambios_dia(empleado_id);
create index idx_intercambios_estado on public.intercambios_dia(estado);

-- EXCLUSIVIDAD del destino: un solo usuario por fecha_destino. Los rechazados liberan la fecha
-- (no cuentan), por eso el índice es parcial.
create unique index uniq_intercambio_destino
  on public.intercambios_dia(fecha_destino)
  where estado <> 'rechazado';

alter table public.intercambios_dia enable row level security;

-- El empleado/doctor crea y ve SOLO los suyos. La resolución (estado) la hace gestión.
create policy intercambios_select_own on public.intercambios_dia
  for select using (empleado_id = (select public.current_usuario_id()));

create policy intercambios_insert_own on public.intercambios_dia
  for insert with check (
    empleado_id = (select public.current_usuario_id())
    and (select public.current_role()) in ('empleado', 'doctor')
  );

create policy intercambios_select_gestion on public.intercambios_dia
  for select using ((select public.current_role()) in ('rh', 'admin', 'psicologa'));

create policy intercambios_update_gestion on public.intercambios_dia
  for update
  using ((select public.current_role()) in ('rh', 'admin', 'psicologa'))
  with check ((select public.current_role()) in ('rh', 'admin', 'psicologa'));

grant select, insert, update on public.intercambios_dia to authenticated;
grant select, insert, update, delete on public.intercambios_dia to service_role;

alter publication supabase_realtime add table public.intercambios_dia;

-- Las fechas destino YA ocupadas, sin revelar QUIÉN las tiene (RLS oculta las filas ajenas al
-- empleado). Así el calendario puede marcar/deshabilitar los destinos tomados sin exponer datos
-- de terceros. Security definer para poder leer todas las filas por encima del RLS.
create or replace function public.intercambios_destinos_ocupados()
returns setof date
language sql stable security definer set search_path = public
as $$
  select fecha_destino from public.intercambios_dia where estado <> 'rechazado';
$$;

grant execute on function public.intercambios_destinos_ocupados() to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select count(*) from public.festivos;                        -- 7 (2026)
--   (empleado A) insert intercambio destino='2026-07-10'         -> OK
--   (empleado B) insert intercambio destino='2026-07-10'         -> DEBE FALLAR (índice único)
--   (empleado B) insert intercambio destino='2026-07-11'         -> OK
--   (rh) update intercambios_dia set estado='rechazado' del de A -> libera '2026-07-10'
-- ----------------------------------------------------------------------------
