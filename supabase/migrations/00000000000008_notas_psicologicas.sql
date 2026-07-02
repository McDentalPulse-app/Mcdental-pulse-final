create table public.notas_psicologicas (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null references public.usuarios(id) on delete cascade,
  autor_id       uuid references public.usuarios(id),
  autor_nombre   text,
  texto          text not null,
  fecha          date not null default current_date,
  created_at     timestamptz not null default now()
);

create index idx_notas_psicologicas_empleado_id on public.notas_psicologicas(empleado_id);
