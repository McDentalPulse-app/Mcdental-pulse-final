-- Bloques rotatorios de la encuesta — Fase 0 (solo esquema).
--
-- La encuesta se separa en dos partes para poder cambiar preguntas cada quincena SIN
-- romper la comparación histórica del Pulse Score:
--   · núcleo   → las 10 preguntas de hoy, todas las semanas. Solo ellas hacen el score.
--   · bloque   → 2-4 preguntas que rotan cada quincena. Se reportan, no puntúan.
--
-- La pertenencia se marca en encuesta_preguntas.bloque_id:
--   NULL  = núcleo  ← por eso las 10 preguntas existentes quedan correctas sin tocarlas
--   uuid  = pertenece a ese bloque
--
-- Qué bloque toca cada quincena NO se guarda aquí: se deriva en el cliente a partir de
-- semanaNumero() y del orden de los bloques (plan-encuesta-bloques.md, Fase 1). Así no hay
-- estado que mantener ni un cron que pueda fallar.
--
-- Esta migración es solo esquema: nada de la app cambia de comportamiento todavía.

create table if not exists public.encuesta_bloques (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- El nombre es lo que RH ve y lo que da sentido a un bloque dentro de un año; dos bloques
-- con el mismo nombre serían indistinguibles en los reportes.
create unique index if not exists uq_encuesta_bloques_nombre
  on public.encuesta_bloques (lower(nombre));

drop trigger if exists trg_encuesta_bloques_updated_at on public.encuesta_bloques;
create trigger trg_encuesta_bloques_updated_at
  before update on public.encuesta_bloques
  for each row execute function set_updated_at();

-- ================= pertenencia de las preguntas =================
-- on delete restrict a propósito: borrar un bloque que todavía tiene preguntas debe fallar
-- en vez de dejarlas huérfanas (que, al quedar con bloque_id null, se colarían al núcleo y
-- al Pulse Score sin que nadie lo pidiera).
alter table public.encuesta_preguntas
  add column if not exists bloque_id uuid
  references public.encuesta_bloques (id) on delete restrict;

create index if not exists idx_encuesta_preguntas_bloque_id
  on public.encuesta_preguntas (bloque_id);

comment on column public.encuesta_preguntas.bloque_id is
  'NULL = pregunta del núcleo (todas las semanas, cuenta para el Pulse Score). '
  'uuid = pertenece a ese bloque rotatorio (solo en su quincena, NO cuenta para el score).';

-- ================= RLS =================
-- Mismo esquema que encuesta_preguntas: la lee cualquier autenticado (el empleado necesita
-- el nombre del bloque para ver el subtítulo de su encuesta) y la escribe gestión.
alter table public.encuesta_bloques enable row level security;

drop policy if exists encuesta_bloques_select_all on public.encuesta_bloques;
create policy encuesta_bloques_select_all
  on public.encuesta_bloques for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists encuesta_bloques_write_gestion on public.encuesta_bloques;
create policy encuesta_bloques_write_gestion
  on public.encuesta_bloques for all
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));
