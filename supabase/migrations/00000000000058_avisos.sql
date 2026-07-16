-- ============================================================================
-- Avisos (comunicados): rh, psicologa y admin publican; los 4 roles los leen.
--
-- Dos tablas: `avisos` (el comunicado en sí) y `avisos_leidos` (quién ya lo aceptó).
-- Se separan porque son dos ciclos de vida distintos — un aviso se edita/borra, un
-- "leído" no: una vez que alguien lo aceptó, esa fila no se toca más.
--
-- El modal bloqueante (src/components/avisos/AvisoModal.jsx) calcula del lado del
-- cliente qué avisos le faltan a la persona: todos los de `avisos` que no tengan su
-- fila correspondiente en `avisos_leidos`. No hay columna "para quién" en `avisos`: es
-- para TODOS, sin excepción — si algún día hace falta dirigirlo a un rol, se agrega
-- ahí, no aquí.
-- ============================================================================

create table public.avisos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  cuerpo     text not null,
  creado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.avisos is
  'Comunicados de rh/psicologa/admin, visibles para los 4 roles. Ver migración 058.';

create index idx_avisos_created_at on public.avisos (created_at desc);

drop trigger if exists trg_avisos_updated_at on public.avisos;
create trigger trg_avisos_updated_at
  before update on public.avisos
  for each row execute function public.set_updated_at();

create table public.avisos_leidos (
  id         bigint generated always as identity primary key,
  aviso_id   uuid not null references public.avisos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  leido_en   timestamptz not null default now(),

  unique (aviso_id, usuario_id)
);

comment on table public.avisos_leidos is
  'Quién ya aceptó cada aviso (el temporizador de 30s + botón "De acuerdo" del modal). Sin UPDATE/DELETE: un leído no se deshace.';

create index idx_avisos_leidos_usuario on public.avisos_leidos (usuario_id);

alter table public.avisos enable row level security;
alter table public.avisos_leidos enable row level security;

-- Grants explícitos en los dos sentidos (la lección de cotejo_intentos, migración 047):
-- sin esto da "permission denied" antes de que RLS opine.
grant select, insert, update, delete on public.avisos to authenticated;
grant select, insert, update, delete on public.avisos to service_role;
grant select, insert on public.avisos_leidos to authenticated;
grant select, insert on public.avisos_leidos to service_role;

-- ================= avisos: SELECT =================
-- Todo autenticado ve el historial completo: es la pantalla "Avisos" para los 4 roles.
drop policy if exists avisos_select_autenticados on public.avisos;
create policy avisos_select_autenticados
  on public.avisos for select
  using ((select public.current_role()) is not null);

-- ================= avisos: INSERT / UPDATE / DELETE =================
-- Solo admin, rh y psicologa (patrón "_gestion" de la migración 050). El insert además
-- exige que `creado_por` sea quien de verdad está llamando: nadie firma un aviso a
-- nombre de otro.
drop policy if exists avisos_insert_gestion on public.avisos;
create policy avisos_insert_gestion
  on public.avisos for insert
  with check (
    creado_por = (select public.current_usuario_id())
    and (select public.current_role()) in ('admin', 'rh', 'psicologa')
  );

drop policy if exists avisos_update_gestion on public.avisos;
create policy avisos_update_gestion
  on public.avisos for update
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

drop policy if exists avisos_delete_gestion on public.avisos;
create policy avisos_delete_gestion
  on public.avisos for delete
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- ================= avisos_leidos: INSERT / SELECT =================
-- Cada quien marca y lee SOLO su propia fila (calcado de push_suscripciones, mig. 049):
-- con la lista en la mano se sabría quién NO ha leído qué, y eso no es lo que se pidió.
drop policy if exists avisos_leidos_insert_propia on public.avisos_leidos;
create policy avisos_leidos_insert_propia
  on public.avisos_leidos for insert
  with check (usuario_id = (select public.current_usuario_id()));

drop policy if exists avisos_leidos_select_propia on public.avisos_leidos;
create policy avisos_leidos_select_propia
  on public.avisos_leidos for select
  using (usuario_id = (select public.current_usuario_id()));

-- Realtime: para que un aviso nuevo le llegue a quien ya tiene la sesión abierta sin
-- esperar al polling de 60s del GlobalContext (mismo patrón que encuestas, migración 024).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'avisos'
  ) then
    alter publication supabase_realtime add table public.avisos;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   (como rh) insert into avisos (titulo, cuerpo, creado_por)
--     values ('Prueba', 'Cuerpo', current_usuario_id()); -> OK
--   (como empleado) mismo insert -> 0 filas (RLS lo bloquea).
--   (como empleado) select * from avisos; -> ve todos.
--   (como empleado) insert into avisos_leidos (aviso_id, usuario_id)
--     values (<id-de-arriba>, current_usuario_id()); -> OK, solo la suya.
--
-- ROLLBACK:
--   drop table if exists public.avisos_leidos;
--   drop table if exists public.avisos;
-- ----------------------------------------------------------------------------
