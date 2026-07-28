-- ============================================================================
-- Reacciones, respuestas y borrado de mensajes (migración 087).
-- ============================================================================

-- ── 1) Responder a un mensaje ───────────────────────────────────────────────
-- `on delete set null` y no `cascade`: si algún día se borra de verdad el mensaje
-- citado, la respuesta NO debe irse con él. Quien contestó dijo lo suyo y eso
-- sigue siendo parte de la conversación; simplemente pierde la cita.
alter table public.mensajes
  add column if not exists responde_a uuid references public.mensajes(id) on delete set null;

create index if not exists idx_mensajes_responde_a
  on public.mensajes (responde_a) where responde_a is not null;

-- ── 2) Borrado ──────────────────────────────────────────────────────────────
-- Borrado BLANDO con lápida, no DELETE. En un canal empleado↔psicóloga, que una
-- de las partes pueda hacer desaparecer sin rastro lo que dijo deja a la otra sin
-- saber siquiera que hubo algo. La lápida es el equilibrio que usa toda la
-- mensajería: el contenido se va de verdad (se pone a null, no se "oculta" en el
-- cliente), pero queda constancia de que ahí hubo un mensaje y quién lo quitó.
alter table public.mensajes
  add column if not exists eliminado_en  timestamptz,
  add column if not exists eliminado_por uuid references public.usuarios(id);

comment on column public.mensajes.eliminado_en is
  'Marca de borrado. El contenido (texto y adjunto) se pone a null: no se oculta en el cliente, se va de la base.';

-- El CHECK de la 086 exigía texto o adjunto. Un mensaje eliminado no tiene
-- ninguno de los dos, así que hay que admitirlo explícitamente — si no, el propio
-- borrado sería imposible.
alter table public.mensajes drop constraint if exists mensajes_contenido_no_vacio;
alter table public.mensajes add constraint mensajes_contenido_no_vacio
  check (
    eliminado_en is not null
    or (texto is not null and length(btrim(texto)) > 0)
    or adjunto_path is not null
  );

-- ── 3) Reacciones ───────────────────────────────────────────────────────────
create table if not exists public.mensaje_reacciones (
  mensaje_id uuid not null references public.mensajes(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  emoji      text not null,
  creado_en  timestamptz not null default now(),
  -- La PK compuesta es la regla de negocio: una persona, un emoji, una vez. Sin
  -- ella habría que contar duplicados en cada consulta y "quitar mi reacción"
  -- dejaría de ser una operación exacta.
  primary key (mensaje_id, usuario_id, emoji),
  constraint mensaje_reacciones_emoji_corto check (length(emoji) between 1 and 8)
);

-- Aquí sí cascade: una reacción no significa nada sin el mensaje al que reacciona.

create index if not exists idx_mensaje_reacciones_mensaje
  on public.mensaje_reacciones (mensaje_id);

alter table public.mensaje_reacciones enable row level security;

-- Puede reaccionar quien participa en el mensaje, y solo en su propio nombre.
drop policy if exists mensaje_reacciones_select_participante on public.mensaje_reacciones;
create policy mensaje_reacciones_select_participante on public.mensaje_reacciones
  for select using (
    exists (
      select 1 from public.mensajes m
      where m.id = mensaje_id
        and (m.de_id = (select current_usuario_id()) or m.para_id = (select current_usuario_id()))
    )
  );

drop policy if exists mensaje_reacciones_insert_propia on public.mensaje_reacciones;
create policy mensaje_reacciones_insert_propia on public.mensaje_reacciones
  for insert with check (
    usuario_id = (select current_usuario_id())
    and exists (
      select 1 from public.mensajes m
      where m.id = mensaje_id
        and (m.de_id = (select current_usuario_id()) or m.para_id = (select current_usuario_id()))
    )
  );

-- Solo la propia: nadie retira la reacción de otro.
drop policy if exists mensaje_reacciones_delete_propia on public.mensaje_reacciones;
create policy mensaje_reacciones_delete_propia on public.mensaje_reacciones
  for delete using (usuario_id = (select current_usuario_id()));

-- ── 4) Realtime ─────────────────────────────────────────────────────────────
-- Para que la reacción aparezca en el otro aparato sin recargar, igual que el
-- mensaje. Idempotente por el mismo motivo que en la 085.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='mensaje_reacciones'
  ) then
    alter publication supabase_realtime add table public.mensaje_reacciones;
    raise notice 'añadida a supabase_realtime: mensaje_reacciones';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- POR QUÉ NO HAY POLÍTICA DE UPDATE PARA BORRAR:
--   La RLS no sabe de columnas. Una política `for update using (de_id = yo)`
--   dejaría al autor cambiar CUALQUIER campo de su mensaje —incluido `texto`—, es
--   decir, reescribir lo que dijo sin que se note. El borrado pasa por
--   `api/eliminar-mensaje.js`, que comprueba la autoría, limpia el archivo del
--   storage y solo toca los campos de la lápida.
--
-- VERIFICACIÓN:
--   (como participante) insert into mensaje_reacciones values (<msg>, current_usuario_id(), '❤');  -> OK
--   (dos veces el mismo emoji)                                                                     -> lo rechaza la PK
--   (como tercero)                                                                                 -> lo rechaza la RLS
--   update mensajes set eliminado_en = now(), texto = null where id = <msg>;                        -> el CHECK lo admite
--
-- ROLLBACK:
--   drop table if exists public.mensaje_reacciones;
--   alter table public.mensajes drop column if exists eliminado_en, drop column if exists eliminado_por;
--   alter table public.mensajes drop column if exists responde_a;
--   (y restaurar el CHECK de la 086)
-- ----------------------------------------------------------------------------
