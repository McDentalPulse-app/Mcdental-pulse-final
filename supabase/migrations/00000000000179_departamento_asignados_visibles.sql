-- ============================================================================
-- 179 — Los miembros de un departamento pueden VER a quién más se le asignó cada tarea.
--
-- Hasta ahora (migración 134) un miembro solo leía SU PROPIA fila de
-- departamento_tarea_asignados: veía la tarea, pero no con quién la compartía. Pedido del
-- dueño (2026-09-29): en la tarjeta de la tarea, junto a "Marcar como completada", mostrar
-- quiénes más están en ese trabajo — como en Teams.
--
-- SOLO LECTURA. Se añade una policy de SELECT; las de escritura no se tocan:
--   · departamento_tarea_asignados_jefe   (for all)  → el jefe administra todo.
--   · departamento_tarea_asignados_propia (for all)  → cada quien marca SOLO la suya.
-- Las policies del mismo comando se combinan con OR, así que esto amplía la lectura sin
-- abrir ninguna escritura: un miembro sigue sin poder marcar la tarea de otro.
--
-- El alcance es el mismo que ya tiene departamento_tareas_select: quien ve la tarea (es
-- miembro del departamento) ve también a sus asignados. Nada fuera del departamento.
-- ============================================================================

create policy departamento_tarea_asignados_select_miembro on public.departamento_tarea_asignados
  for select
  using (
    public.es_miembro_departamento((select departamento_id from public.departamento_tareas where id = tarea_id))
  );

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (como un miembro que NO es jefe):
--   select * from departamento_tarea_asignados where tarea_id = '<tarea de su depto>';
--     -> ve TODAS las asignaciones de esa tarea, no solo la suya.
--   update departamento_tarea_asignados set completada = true
--    where tarea_id = '<esa tarea>' and usuario_id = '<un compañero>';
--     -> 0 filas: sigue sin poder marcar la de otro.
--   select * from departamento_tarea_asignados where tarea_id = '<tarea de OTRO depto>';
--     -> 0 filas.
--
-- ROLLBACK:
--   drop policy if exists departamento_tarea_asignados_select_miembro on public.departamento_tarea_asignados;
-- ----------------------------------------------------------------------------
