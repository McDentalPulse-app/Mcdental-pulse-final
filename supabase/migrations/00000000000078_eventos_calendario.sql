-- ============================================================================
-- Eventos de calendario (agenda de la clínica): citas, reuniones y actividades con HORA.
--
-- Es lo que faltaba para tener un calendario tipo "event calendar" (Mes/Semana/Día con rejilla
-- de horas): un evento tiene fecha + hora de inicio/fin + color. Los festivos, vacaciones y
-- permisos (que son por día) se siguen mostrando encima como "todo el día"; estos eventos son
-- los que llenan la rejilla horaria.
--
-- Quién administra: gestión (admin/rh/psicologa) crea/edita/borra. Todos los autenticados leen
-- (es la agenda compartida de la clínica).
-- ============================================================================

create table public.eventos_calendario (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  fecha        date not null,
  hora_inicio  time,                    -- null cuando es de todo el día
  hora_fin     time,
  todo_el_dia  boolean not null default false,
  color        text not null default 'azul',  -- azul/morado/rosa/ambar/verde/aqua/rojo/gris
  ubicacion    text,
  creado_por   uuid references public.usuarios(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_eventos_calendario_updated_at
  before update on public.eventos_calendario
  for each row execute function public.set_updated_at();

create index idx_eventos_calendario_fecha on public.eventos_calendario(fecha);

alter table public.eventos_calendario enable row level security;

-- Todos los autenticados ven la agenda.
create policy eventos_select_all on public.eventos_calendario
  for select using (auth.uid() is not null);

-- Gestión administra.
create policy eventos_insert_gestion on public.eventos_calendario
  for insert with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

create policy eventos_update_gestion on public.eventos_calendario
  for update
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

create policy eventos_delete_gestion on public.eventos_calendario
  for delete using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

grant select, insert, update, delete on public.eventos_calendario to authenticated;
grant select, insert, update, delete on public.eventos_calendario to service_role;

alter publication supabase_realtime add table public.eventos_calendario;
