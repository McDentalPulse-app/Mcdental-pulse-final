-- Tolerancia de llegada tarde: 10 minutos para todos, sin excepción.
--
-- Decisión de negocio (2026-07-15, misma tanda que el horario fijo 10-19/10-14): con
-- entrada a las 10:00 y 10 minutos de gracia, las 10:10 llegan a tiempo; las 10:11 ya
-- es retardo (la comparación en clasificarDia() es estricta, ver src/utils/asistencia.js).
-- Antes quedaba en 15 (el valor por defecto de la pantalla "Horarios"), ahora se baja a 10
-- en TODOS los renglones ya cargados.

update public.horarios
set tolerancia_min = 10;

-- El DEFAULT de la columna (migración 035) también queda en 10: cualquier insert futuro
-- que no mande tolerancia_min explícita (una migración de datos, un script) debe caer en
-- la misma regla, no en el 15 viejo.
alter table public.horarios
  alter column tolerancia_min set default 10;

-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   update public.horarios set tolerancia_min = 15;
--   alter table public.horarios alter column tolerancia_min set default 15;
