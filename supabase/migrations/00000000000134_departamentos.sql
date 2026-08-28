-- ============================================================================
-- Departamentos (estilo "clases" de Teams) — migración 134.
-- Un jefe de departamento (puede_crear_departamento, migración 133) crea su propio
-- departamento, mete gente, manda avisos/mensajes al grupo y asigna tareas con fecha
-- límite. Cada quien marca su propia tarea como hecha; el jefe ve el estado de todos.
-- ============================================================================

-- ── Tablas ───────────────────────────────────────────────────────────────────
create table public.departamentos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(btrim(nombre)) > 0),
  descripcion text,
  color       text not null default 'azul',
  -- default, no solo not null: el cliente no manda jefe_id en el insert (lo decide el
  -- servidor) — mismo bug que costó un 403 en notas.usuario_id (migración 132), evitado
  -- aquí desde el principio.
  jefe_id     uuid not null default public.current_usuario_id() references public.usuarios(id) on delete cascade,
  created_at  timestamptz not null default now()
);

comment on table public.departamentos is
  'Departamentos internos (estilo Team/clase). Ver migración 134.';

create index idx_departamentos_jefe on public.departamentos (jefe_id);

create table public.departamento_miembros (
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (departamento_id, usuario_id)
);

create index idx_departamento_miembros_usuario on public.departamento_miembros (usuario_id);

-- Feed del departamento: avisos del jefe y mensajes casuales entre miembros, mezclados
-- como los "Posts" de un Team. Texto plano (no HTML) — es chat, no un comunicado con
-- formato, así que no necesita pasar por TipTap/DOMPurify.
create table public.departamento_publicaciones (
  id              uuid primary key default gen_random_uuid(),
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  autor_id        uuid not null default public.current_usuario_id() references public.usuarios(id) on delete cascade,
  tipo            text not null check (tipo in ('aviso', 'mensaje')),
  texto           text not null check (length(btrim(texto)) > 0),
  created_at      timestamptz not null default now()
);

create index idx_departamento_publicaciones_dep on public.departamento_publicaciones (departamento_id, created_at desc);

create table public.departamento_tareas (
  id              uuid primary key default gen_random_uuid(),
  departamento_id uuid not null references public.departamentos(id) on delete cascade,
  titulo          text not null check (length(btrim(titulo)) > 0),
  descripcion     text,
  fecha_limite    date,
  creado_por      uuid not null default public.current_usuario_id() references public.usuarios(id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index idx_departamento_tareas_dep on public.departamento_tareas (departamento_id, created_at desc);

create table public.departamento_tarea_asignados (
  tarea_id       uuid not null references public.departamento_tareas(id) on delete cascade,
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  completada     boolean not null default false,
  completada_en  timestamptz,
  primary key (tarea_id, usuario_id)
);

-- ── Funciones RLS security-definer ──────────────────────────────────────────
-- Mismo patrón que current_usuario_id()/current_role() (migración 015): evitan que una
-- policy de departamento_miembros tenga que leerse a sí misma para saber si alguien
-- pertenece al departamento (recursión de RLS). Van después de las tablas: una función
-- `language sql` se valida contra los objetos que referencia al crearse.
create or replace function public.es_miembro_departamento(dep_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.departamento_miembros
    where departamento_id = dep_id and usuario_id = public.current_usuario_id()
  );
$$;

create or replace function public.es_jefe_departamento(dep_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.departamentos
    where id = dep_id and jefe_id = public.current_usuario_id()
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.departamentos enable row level security;

create policy departamentos_select_miembro on public.departamentos for select
  using (public.es_miembro_departamento(id) or jefe_id = (select public.current_usuario_id()));

create policy departamentos_insert_jefe on public.departamentos for insert
  with check (
    jefe_id = (select public.current_usuario_id())
    and (select puede_crear_departamento from public.usuarios where id = (select public.current_usuario_id()))
  );

create policy departamentos_update_jefe on public.departamentos for update
  using (jefe_id = (select public.current_usuario_id()))
  with check (jefe_id = (select public.current_usuario_id()));

create policy departamentos_delete_jefe on public.departamentos for delete
  using (jefe_id = (select public.current_usuario_id()));

alter table public.departamento_miembros enable row level security;

create policy departamento_miembros_select on public.departamento_miembros for select
  using (public.es_miembro_departamento(departamento_id));

create policy departamento_miembros_insert_jefe on public.departamento_miembros for insert
  with check (public.es_jefe_departamento(departamento_id));

create policy departamento_miembros_delete_jefe on public.departamento_miembros for delete
  using (public.es_jefe_departamento(departamento_id));

alter table public.departamento_publicaciones enable row level security;

create policy departamento_publicaciones_select on public.departamento_publicaciones for select
  using (public.es_miembro_departamento(departamento_id));

-- Cualquier miembro publica 'mensaje'; solo el jefe publica 'aviso'.
create policy departamento_publicaciones_insert on public.departamento_publicaciones for insert
  with check (
    autor_id = (select public.current_usuario_id())
    and public.es_miembro_departamento(departamento_id)
    and (tipo <> 'aviso' or public.es_jefe_departamento(departamento_id))
  );

alter table public.departamento_tareas enable row level security;

create policy departamento_tareas_select on public.departamento_tareas for select
  using (public.es_miembro_departamento(departamento_id));

create policy departamento_tareas_all_jefe on public.departamento_tareas for all
  using (public.es_jefe_departamento(departamento_id))
  with check (public.es_jefe_departamento(departamento_id));

alter table public.departamento_tarea_asignados enable row level security;

-- El jefe administra asignaciones de sus propios departamentos...
create policy departamento_tarea_asignados_jefe on public.departamento_tarea_asignados for all
  using (public.es_jefe_departamento((select departamento_id from public.departamento_tareas where id = tarea_id)))
  with check (public.es_jefe_departamento((select departamento_id from public.departamento_tareas where id = tarea_id)));

-- ...y cada quien puede leer/actualizar SOLO su propia fila (marcar su tarea como
-- hecha) — no puede tocar la de nadie más porque usuario_id lo fija en ambos lados.
create policy departamento_tarea_asignados_propia on public.departamento_tarea_asignados for all
  using (usuario_id = (select public.current_usuario_id()))
  with check (usuario_id = (select public.current_usuario_id()));

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (ver plan: probado en transacción con rollback antes de aplicar de
-- verdad, con cuentas reales — aislamiento, aviso solo-jefe, tarea solo-propia).
--
-- ROLLBACK:
--   drop table if exists public.departamento_tarea_asignados;
--   drop table if exists public.departamento_tareas;
--   drop table if exists public.departamento_publicaciones;
--   drop table if exists public.departamento_miembros;
--   drop table if exists public.departamentos;
--   drop function if exists public.es_miembro_departamento(uuid);
--   drop function if exists public.es_jefe_departamento(uuid);
-- ----------------------------------------------------------------------------
