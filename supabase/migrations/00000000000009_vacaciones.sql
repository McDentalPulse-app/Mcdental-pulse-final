create table public.vacaciones (
  id               uuid primary key default gen_random_uuid(),
  empleado_id      uuid not null references public.usuarios(id) on delete cascade,
  fecha_inicio     date not null,
  fecha_fin        date not null,
  dias             integer not null default 1,
  motivo           text,
  comentario       text,
  comentario_rh    text,
  estado           public.estado_solicitud not null default 'pendiente',
  origen           public.origen_solicitud not null default 'empleado',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_vacaciones_updated_at
  before update on public.vacaciones
  for each row execute function public.set_updated_at();

create index idx_vacaciones_empleado_id on public.vacaciones(empleado_id);
create index idx_vacaciones_estado on public.vacaciones(estado);
