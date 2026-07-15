-- ============================================================================
-- Horarios laborales por empleado y día de la semana.
--
-- Sin esto, el checador puede registrar la hora a la que alguien llegó, pero no
-- puede decir si llegó TARDE: "las 9:07" no significa nada si nadie sabe que su
-- entrada son las 9:00 con 10 minutos de tolerancia.
--
-- Un renglón por empleado y día laboral. LA AUSENCIA DE RENGLÓN ES EL DESCANSO:
-- si no hay fila para el domingo, el domingo no cuenta como falta. Esto evita
-- inventar un catálogo de turnos y una tabla de días festivos que nadie pidió, y
-- soporta directamente el caso real de una clínica (sábado corto: misma tabla,
-- hora_salida distinta).
--
-- dia_semana usa la numeración ISO-8601 (1=lunes … 7=domingo), la misma que ya
-- usa getISOWeek() en src/utils/constants.js. Postgres tiene DOS numeraciones
-- (extract(dow) da 0=domingo, extract(isodow) da 1=lunes): al cruzar horarios con
-- fechas hay que usar SIEMPRE isodow, o el lunes se compara contra el martes.
-- ============================================================================

create table if not exists public.horarios (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null references public.usuarios(id) on delete cascade,
  dia_semana     smallint not null check (dia_semana between 1 and 7),  -- ISO: 1=lunes, 7=domingo
  hora_entrada   time not null,
  hora_salida    time not null,
  tolerancia_min smallint not null default 15 check (tolerancia_min between 0 and 120),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.horarios is
  'Horario laboral por empleado y día ISO (1=lunes..7=domingo). Sin fila para un día = ese día es descanso y no cuenta como falta. Ver migración 035.';
comment on column public.horarios.tolerancia_min is
  'Minutos de gracia después de hora_entrada antes de contar retardo. Entrar en el minuto exacto del límite NO es retardo (la comparación es estricta: > entrada + tolerancia).';
comment on column public.horarios.hora_salida is
  'LIMITACIÓN CONOCIDA: los turnos que cruzan la medianoche NO están soportados. La checada se agrupa por día natural (America/Monterrey), así que la salida de un turno nocturno caería en el día siguiente, donde no hay entrada — y registrar_checada() la rechaza. Se asume horario diurno, que es el caso real de una clínica dental. Soportar turnos nocturnos exige emparejar checadas entre días consecutivos, y no se ha construido porque nadie lo ha pedido.';

-- Un solo horario por empleado y día. Sin esto, dos renglones para el lunes hacen
-- que "¿llegó tarde?" no tenga una respuesta única.
create unique index if not exists uq_horarios_empleado_dia
  on public.horarios (empleado_id, dia_semana);

drop trigger if exists trg_horarios_updated_at on public.horarios;
create trigger trg_horarios_updated_at
  before update on public.horarios
  for each row execute function public.set_updated_at();

alter table public.horarios enable row level security;

-- Grants explícitos: sin esto la tabla da "permission denied" y RLS ni se evalúa
-- (las migraciones corren como 'postgres', cuyo default privilege en Supabase no
-- incluye SELECT/INSERT/UPDATE). El acceso real lo deciden las policies de abajo.
grant select, insert, update, delete on public.horarios to authenticated;
grant select, insert, update, delete on public.horarios to service_role;

-- El empleado ve SU horario (el checador se lo muestra: "hoy entras a las 9:00").
drop policy if exists horarios_select_own on public.horarios;
create policy horarios_select_own
  on public.horarios for select
  using (empleado_id = (select public.current_usuario_id()));

-- Los roles de gestión ven todos (la rejilla de horarios y los reportes).
drop policy if exists horarios_select_gestion on public.horarios;
create policy horarios_select_gestion
  on public.horarios for select
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));

-- Escritura: admin y rh. Cambiar un horario cambia retroactivamente quién llegó
-- tarde (el estado del día es derivado, no almacenado), así que no es un permiso menor.
drop policy if exists horarios_insert_admin_rh on public.horarios;
create policy horarios_insert_admin_rh
  on public.horarios for insert
  with check ((select public.current_role()) in ('admin', 'rh'));

drop policy if exists horarios_update_admin_rh on public.horarios;
create policy horarios_update_admin_rh
  on public.horarios for update
  using ((select public.current_role()) in ('admin', 'rh'))
  with check ((select public.current_role()) in ('admin', 'rh'));

-- DELETE sí existe aquí, a diferencia del resto de la app: borrar el renglón del
-- sábado es exactamente cómo se dice "este empleado ya no trabaja los sábados".
-- No es destruir un registro histórico, es cambiar una configuración vigente.
drop policy if exists horarios_delete_admin_rh on public.horarios;
create policy horarios_delete_admin_rh
  on public.horarios for delete
  using ((select public.current_role()) in ('admin', 'rh'));

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   insert into public.horarios (empleado_id, dia_semana, hora_entrada, hora_salida)
--   select id, 1, '09:00', '18:00' from public.usuarios limit 1;
--     -> OK como admin/rh; 0 filas (RLS) como empleado.
--
--   -- el mismo empleado y día dos veces:
--   -> debe fallar con "duplicate key value violates unique constraint uq_horarios_empleado_dia".
--
-- ROLLBACK:
--   drop table if exists public.horarios;
-- ----------------------------------------------------------------------------
