create table public.mensajes (
  id          uuid primary key default gen_random_uuid(),
  de_id       uuid not null references public.usuarios(id) on delete cascade,
  para_id     uuid not null references public.usuarios(id) on delete cascade,
  texto       text not null,
  leido       boolean not null default false,
  fecha       timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index idx_mensajes_de_id on public.mensajes(de_id);
create index idx_mensajes_para_id on public.mensajes(para_id);
