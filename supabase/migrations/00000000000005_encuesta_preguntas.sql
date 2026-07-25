create table public.encuesta_preguntas (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   integer unique,   -- referenciado como clave dentro de encuestas.respuestas (jsonb)
  texto       text not null,
  tipo        public.tipo_pregunta not null,
  area        text,
  opciones    text[],           -- solo si tipo = 'opcion'
  orden       integer not null default 0,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_encuesta_preguntas_updated_at
  before update on public.encuesta_preguntas
  for each row execute function public.set_updated_at();
