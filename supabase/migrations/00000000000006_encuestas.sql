create table public.encuestas (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references public.usuarios(id) on delete cascade,
  semana       text,                                    -- clave de semana (ej. "2026-W27")
  respuestas   jsonb not null default '{}'::jsonb,       -- { "<legacy_id_pregunta>": valor }
  pulse_score  numeric(5,2),
  fecha        date not null default current_date,
  created_at   timestamptz not null default now()
);

create index idx_encuestas_empleado_id on public.encuestas(empleado_id);
create index idx_encuestas_fecha on public.encuestas(fecha);
