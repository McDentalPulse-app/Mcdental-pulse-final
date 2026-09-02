-- Permite que cada quien VACÍE su propia bandeja de notificaciones.
--
-- Hasta ahora la tabla solo tenía políticas de SELECT y UPDATE: se podían marcar leídas, pero
-- no quitar de en medio. Con el tiempo la campana se llena de solicitudes ya resueltas y hay
-- que bajar por una lista larga para ver lo de hoy.
--
-- Solo las propias: la política repite el mismo `empleado_id = current_usuario_id()` que las
-- otras dos, así que nadie puede borrar la bandeja de nadie más.
--
-- Qué se borra y qué no lo decide el cliente (notificacionesService.limpiarNotificaciones):
-- las CRÍTICAS VIGENTES se conservan a propósito. Una alerta de un problema sin resolver no
-- debe poder despacharse con un botón — es justo lo que dejó el respaldo externo seis días
-- caído con los avisos leídos. Las críticas viejas (>48 h) sí se van: si el problema sigue,
-- la tarea de fondo vuelve a emitirlas.
create policy notificaciones_delete_own on public.notificaciones
  for delete using (empleado_id = (select public.current_usuario_id()));
