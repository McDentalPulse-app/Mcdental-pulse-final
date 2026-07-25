-- ============================================================================
-- Permisos: causa y rango de fechas.
--
-- La tabla `permisos` (migración 010) solo tenía `fecha` (un día suelto) y `motivo`
-- (texto libre). Con el checador esto se queda corto por dos razones:
--
-- 1. Un permiso justifica una AUSENCIA, y las ausencias duran días: una incapacidad de
--    tres días necesita un rango, no tres solicitudes sueltas. Sin fecha_fin, la lógica
--    de asistencia solo podría justificar el primer día y los otros dos saldrían como
--    faltas.
-- 2. `motivo` en texto libre no se puede agregar. "Cita médica", "cita al doctor" y
--    "medico" son la misma causa escrita de tres formas, y ningún reporte puede contarlas
--    juntas. La causa se acota a un catálogo; el texto libre se queda en `comentario`,
--    que es donde debe estar.
--
-- Aditiva y compatible: las filas existentes se quedan con causa NULL y fecha_fin NULL,
-- que la app interpreta como "un solo día, sin causa clasificada" — exactamente lo que
-- significaban antes.
-- ============================================================================

alter table public.permisos
  add column if not exists causa     text,
  add column if not exists fecha_fin date;

comment on column public.permisos.causa is
  'Catálogo cerrado (ver constraint). El texto libre del empleado va en `comentario`, no aquí: una causa que no se puede agrupar no sirve para ningún reporte.';
comment on column public.permisos.fecha_fin is
  'Último día del permiso, inclusive. NULL = permiso de un solo día (la fecha de `fecha`). Lo consume clasificarDia() en src/utils/asistencia.js para no contar como falta un día justificado.';

-- Catálogo de causas. Se permite NULL por las filas viejas, que no tienen ninguna.
alter table public.permisos drop constraint if exists permisos_causa_valida;
alter table public.permisos add constraint permisos_causa_valida check (
  causa is null or causa in (
    'enfermedad',
    'cita_medica',
    'asunto_personal',
    'luto',
    'tramite_oficial',
    'otro'
  )
);

-- Un permiso que termina antes de empezar es un dato imposible, y justificaría cero días
-- en silencio en vez de fallar.
alter table public.permisos drop constraint if exists permisos_rango_valido;
alter table public.permisos add constraint permisos_rango_valido check (
  fecha_fin is null or fecha_fin >= fecha
);

-- La consulta que va a hacer el módulo de asistencia todo el tiempo es "¿este empleado
-- tiene algún permiso aprobado que cubra esta fecha?".
create index if not exists idx_permisos_empleado_fecha
  on public.permisos (empleado_id, fecha);

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   insert into public.permisos (empleado_id, fecha, fecha_fin, causa)
--   select id, current_date, current_date + 2, 'enfermedad' from public.usuarios limit 1;
--     -> OK, permiso de 3 días.
--
--   update public.permisos set causa = 'gripa';        -> DEBE FALLAR (causa fuera del catálogo)
--   update public.permisos set fecha_fin = fecha - 1;  -> DEBE FALLAR (rango invertido)
--
-- ROLLBACK:
--   alter table public.permisos drop constraint if exists permisos_causa_valida;
--   alter table public.permisos drop constraint if exists permisos_rango_valido;
--   alter table public.permisos drop column if exists causa;
--   alter table public.permisos drop column if exists fecha_fin;
-- ----------------------------------------------------------------------------
