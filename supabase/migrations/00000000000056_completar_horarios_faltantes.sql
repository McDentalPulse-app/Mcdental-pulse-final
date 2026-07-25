-- Completa el horario general (10:00-19:00 Lun-Vie, 10:00-14:00 sábado) para quien no
-- tenga TODAVÍA un renglón en `horarios` para alguno de esos seis días.
--
-- Las migraciones 053 y 055 ya arreglaron las HORAS de los renglones que ya existían.
-- Pero ninguna de las dos creaba renglones nuevos: quien nunca tuvo su horario cargado
-- (de alta reciente, o simplemente nadie pasó por la pantalla "Horarios" con esa
-- persona) seguía sin nada, y la pantalla le mostraba "Añadir turno" en vez del horario
-- ya asignado. Esta migración llena exactamente esos huecos.
--
-- Domingo (día 7) se deja fuera A PROPÓSITO: sin renglón ahí sigue siendo descanso,
-- que es la regla de negocio ("solo se trabaja hasta el sábado").
--
-- No pisa nada: el ON CONFLICT hace que si la persona YA tenía ese día configurado
-- (con estas horas u otras, ya fuera por las migraciones anteriores o a mano), esa fila
-- se deja intacta.

insert into public.horarios (empleado_id, dia_semana, hora_entrada, hora_salida, tolerancia_min)
select
  u.id,
  dias.dia,
  '10:00'::time,
  case when dias.dia = 6 then '14:00'::time else '19:00'::time end,
  15
from public.usuarios u
cross join (values (1), (2), (3), (4), (5), (6)) as dias(dia)
where u.inactivo = false
on conflict (empleado_id, dia_semana) do nothing;

-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   No hay forma de distinguir "lo insertó esta migración" de "ya existía igual" sin
--   guardar antes una copia. Si hace falta deshacer, restaurar `horarios` desde un
--   respaldo tomado antes de aplicar esta migración.
