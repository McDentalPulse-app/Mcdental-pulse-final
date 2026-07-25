-- Ajuste al horario fijo de la migración 053: el sábado es medio día.
--
-- Decisión de negocio (2026-07-15, misma tanda que el horario fijo 10-19): entrada 10:00 igual
-- que el resto de la semana, pero salida 14:00 — el sábado es el último día laborable y se sale
-- temprano. Solo toca las filas de sábado (dia_semana = 7 ISO... ver nota) que YA existen; no
-- crea sábado para quien no lo tuviera (eso seguiría siendo su día de descanso).
--
-- OJO CON LA NUMERACIÓN: horarios.dia_semana usa ISO-8601 (1=lunes … 7=domingo, migración 035),
-- así que sábado es 6, NO 7. Confundir esto pondría el ajuste en domingo por error.

update public.horarios
set hora_salida = '14:00'
where dia_semana = 6;

-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   update public.horarios set hora_salida = '19:00' where dia_semana = 6;
