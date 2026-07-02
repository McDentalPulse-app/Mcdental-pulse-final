create table public.permisos (
  id               uuid primary key default gen_random_uuid(),
  empleado_id      uuid not null references public.usuarios(id) on delete cascade,
  fecha            date not null,
  hora             time,
  motivo           text,
  comentario       text,
  comentario_rh    text,
  estado           public.estado_solicitud not null default 'pendiente',
  origen           public.origen_solicitud not null default 'empleado',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_permisos_updated_at
  before update on public.permisos
  for each row execute function public.set_updated_at();

create index idx_permisos_empleado_id on public.permisos(empleado_id);
create index idx_permisos_estado on public.permisos(estado);
