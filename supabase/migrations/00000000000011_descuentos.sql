create table public.descuentos (
  id                  uuid primary key default gen_random_uuid(),
  empleado_id         uuid not null references public.usuarios(id) on delete cascade,
  tipo                text,
  motivo              text,
  observaciones       text,
  monto               numeric(10,2) not null,
  fecha               date not null,
  estado              public.estado_descuento not null default 'pendiente',
  responsable_id      uuid references public.usuarios(id),
  responsable_nombre  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_descuentos_updated_at
  before update on public.descuentos
  for each row execute function public.set_updated_at();

create index idx_descuentos_empleado_id on public.descuentos(empleado_id);
