create table public.reconocimientos (
  id                    uuid primary key default gen_random_uuid(),
  empleado_id           uuid not null references public.usuarios(id) on delete cascade,
  categoria             text not null,
  comentario            text,
  otorgado_por          uuid references public.usuarios(id),
  otorgado_por_nombre   text,
  fecha                 date not null default current_date,
  created_at            timestamptz not null default now()
);

create index idx_reconocimientos_empleado_id on public.reconocimientos(empleado_id);
