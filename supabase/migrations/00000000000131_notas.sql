-- ============================================================================
-- Notas personales (estilo Obsidian) — migración 131.
-- 100% privadas: cada usuario ve y edita solo las suyas, ni admin tiene acceso.
-- ============================================================================

create table public.notas (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  titulo      text not null check (length(btrim(titulo)) > 0),
  cuerpo      text not null default '',      -- HTML de TipTap, igual que avisos.cuerpo
  carpeta     text,                          -- libreta plana, no árbol anidado
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.notas is
  'Notas personales por usuario, 100% privadas (RLS). Ver migración 131.';

create index idx_notas_usuario on public.notas (usuario_id);
create index idx_notas_tags on public.notas using gin (tags);
-- Título único por usuario (sin distinguir mayúsculas): es como se resuelve un
-- enlace [[Título]] a una nota real, igual que en Obsidian.
create unique index idx_notas_usuario_titulo on public.notas (usuario_id, lower(titulo));

drop trigger if exists trg_notas_updated_at on public.notas;
create trigger trg_notas_updated_at
  before update on public.notas
  for each row execute function public.set_updated_at();

alter table public.notas enable row level security;

drop policy if exists notas_all_propia on public.notas;
create policy notas_all_propia on public.notas for all
  using (usuario_id = (select public.current_usuario_id()))
  with check (usuario_id = (select public.current_usuario_id()));

-- Enlaces [[Título]] encontrados en el cuerpo de una nota, recalculados al guardar.
-- titulo_destino es el texto tal cual se escribió entre corchetes — puede no existir
-- todavía como nota real (se resuelve/crea al hacer clic, como en Obsidian).
create table public.nota_links (
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  origen_id      uuid not null references public.notas(id) on delete cascade,
  titulo_destino text not null,
  primary key (origen_id, titulo_destino)
);

comment on table public.nota_links is
  'Enlaces [[Título]] salientes de cada nota. Ver migración 131.';

create index idx_nota_links_destino on public.nota_links (usuario_id, lower(titulo_destino));

alter table public.nota_links enable row level security;

drop policy if exists nota_links_all_propia on public.nota_links;
create policy nota_links_all_propia on public.nota_links for all
  using (usuario_id = (select public.current_usuario_id()))
  with check (usuario_id = (select public.current_usuario_id()));
