-- ============================================================================
-- Reuniones por vídeo (migración 090).
--
-- Tabla propia y no `eventos_calendario`: aquella es la agenda GENERAL de la
-- clínica —un evento que todos ven— y no tiene participantes ni respuestas. Una
-- convocatoria es otra cosa: tiene una lista de invitados, y quien no está en ella
-- no debería ni saber que existe.
-- ============================================================================

create table if not exists public.reuniones (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (length(btrim(titulo)) between 1 and 160),
  descripcion text,
  inicio      timestamptz not null,
  fin         timestamptz,
  -- Identificador OPACO de la sala, no el título. Una sala llamada "revision-de-
  -- desempeno-erick" se adivina desde fuera, y en Jitsi el nombre de la sala es
  -- la puerta. Lo genera el servidor.
  sala        text not null unique check (sala ~ '^[a-z0-9]{24,64}$'),
  creado_por  uuid not null references public.usuarios(id),
  estado      text not null default 'convocada'
              check (estado in ('convocada', 'cancelada', 'terminada')),
  created_at  timestamptz not null default now(),
  check (fin is null or fin > inicio)
);

create index if not exists idx_reuniones_inicio on public.reuniones (inicio desc);

create table if not exists public.reunion_invitados (
  reunion_id uuid not null references public.reuniones(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estado     text not null default 'invitado'
             check (estado in ('invitado', 'acepta', 'rechaza')),
  creado_en  timestamptz not null default now(),
  -- Una persona, una vez, por reunión.
  primary key (reunion_id, usuario_id)
);

create index if not exists idx_reunion_invitados_usuario
  on public.reunion_invitados (usuario_id);

alter table public.reuniones enable row level security;
alter table public.reunion_invitados enable row level security;

-- ── Quién ve qué ────────────────────────────────────────────────────────────
-- Una reunión la ve quien la convocó y quien está invitado. Nadie más: que el
-- resto de la plantilla pueda listar las reuniones de la psicóloga diría, por el
-- solo hecho de existir, con quién se está reuniendo.
drop policy if exists reuniones_select_participante on public.reuniones;
create policy reuniones_select_participante on public.reuniones
  for select using (
    creado_por = (select current_usuario_id())
    or exists (
      select 1 from public.reunion_invitados i
      where i.reunion_id = id and i.usuario_id = (select current_usuario_id())
    )
  );

-- Convocar es cosa de gestión, y siempre en nombre propio.
drop policy if exists reuniones_insert_gestion on public.reuniones;
create policy reuniones_insert_gestion on public.reuniones
  for insert with check (
    (select "current_role"()) = any (array['admin','rh','psicologa']::rol_usuario[])
    and creado_por = (select current_usuario_id())
  );

-- NO hay política de UPDATE ni DELETE, por lo mismo que en el chat: la RLS no
-- distingue columnas, así que una política para "cancelar" permitiría también
-- reescribir la hora o el título de una convocatoria ya enviada. Cancelar pasa por
-- endpoint, donde se puede acotar a los campos que tocan.

drop policy if exists reunion_invitados_select_participante on public.reunion_invitados;
create policy reunion_invitados_select_participante on public.reunion_invitados
  for select using (
    usuario_id = (select current_usuario_id())
    or exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.creado_por = (select current_usuario_id())
    )
  );

-- Invita quien convocó.
drop policy if exists reunion_invitados_insert_anfitrion on public.reunion_invitados;
create policy reunion_invitados_insert_anfitrion on public.reunion_invitados
  for insert with check (
    exists (
      select 1 from public.reuniones r
      where r.id = reunion_id and r.creado_por = (select current_usuario_id())
    )
  );

-- Cada quien responde por sí mismo. Aquí sí vale una política de UPDATE porque la
-- fila solo tiene un campo que pueda cambiar (`estado`): no hay nada más que
-- alguien pudiera reescribir aprovechándola.
drop policy if exists reunion_invitados_update_propia on public.reunion_invitados;
create policy reunion_invitados_update_propia on public.reunion_invitados
  for update using (usuario_id = (select current_usuario_id()))
  with check (usuario_id = (select current_usuario_id()));

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Para que la invitación aparezca sin recargar, igual que los mensajes.
do $$
declare t text;
begin
  foreach t in array array['reuniones', 'reunion_invitados'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'añadida a supabase_realtime: %', t;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (como empleado) insert into reuniones ...                 -> rechazado por la RLS
--   (como rh)       insert into reuniones ... creado_por=yo   -> OK
--   (como invitado) select de esa reunión                     -> la ve
--   (como tercero)  select de esa reunión                     -> 0 filas
--   (como invitado) update reunion_invitados set estado='acepta' donde soy yo -> OK
--   (como invitado) lo mismo sobre la fila de OTRO            -> 0 filas
--
-- ROLLBACK:
--   drop table if exists public.reunion_invitados;
--   drop table if exists public.reuniones;
-- ----------------------------------------------------------------------------
