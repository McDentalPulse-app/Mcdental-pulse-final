-- Horario fijo único: 10:00 a 19:00 para todos los empleados, en todas las sucursales.
--
-- Decisión de negocio (2026-07-15): se unifica el horario de entrada/salida sin excepción,
-- para TODAS las filas ya cargadas en `horarios` (no crea filas nuevas: el día de descanso de
-- cada quien, si no tiene fila, sigue sin tenerla — eso no lo cambia esta migración, solo las
-- horas de los días que ya son laborables para cada empleado).
--
-- ZONA HORARIA: esta tabla guarda `time` sin huso (ver migración 035): no hay conversión que
-- hacer aquí. Las funciones que comparan una checada contra este horario
-- (registrar_checada/salida_segun_horario/salida_anticipada, migraciones 036/039/045) ya
-- interpretan hora_entrada/hora_salida como hora LOCAL fija en America/Monterrey — así que
-- guardar el literal '10:00'/'19:00' es exactamente correcto, sin necesidad de restar ni sumar
-- nada. El riesgo real habría sido escribir aquí una hora ya convertida a UTC por error; no es
-- el caso, es un valor literal.
--
-- ADVERTENCIA (preexistente, no la resuelve esta migración): la constante `America/Monterrey`
-- es la misma para las 25 sucursales, incluida Hermosillo (Sonora, UTC-7 todo el año, sin
-- horario de verano) y Reynosa (zona fronteriza, SÍ observa horario de verano). Para esas dos
-- sucursales la hora "local real" puede no coincidir con la que asume el sistema. Es una
-- limitación de arquitectura ya existente (una sola zona horaria para toda la empresa), no algo
-- que este cambio de horario introduzca ni resuelva.

update public.horarios
set hora_entrada = '10:00',
    hora_salida  = '19:00';

-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   No hay un valor previo único que restaurar (cada fila podía tener una hora distinta antes
--   de esta migración). Si hace falta deshacer, restaurar desde un respaldo de `horarios` tomado
--   antes de aplicar esta migración.
