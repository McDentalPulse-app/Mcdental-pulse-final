-- Avisos CRÍTICOS: los que no se pueden despachar leyéndolos.
--
-- ============================================================================
-- EL CASO QUE LO MOTIVA
-- ============================================================================
--
-- El respaldo externo dejó de funcionar el 29 de julio. El vigilante lo detectó, avisó cada
-- día, el aviso llegó a admin, RH y psicóloga, y el admin lo leyó tres días seguidos:
--
--     Lic. Mario Ruiz  admin  "No hay respaldo externo desde hace días"  LEÍDA  02-ago
--     Lic. Mario Ruiz  admin  "No hay respaldo externo desde hace días"  LEÍDA  03-ago
--     Lic. Mario Ruiz  admin  "No hay respaldo externo desde hace días"  LEÍDA  04-ago
--
-- Seis días después seguía sin haber copia fuera del servidor. El problema no era detectar ni
-- avisar: era que **marcar como leído se confunde con haberlo resuelto**, y que ese aviso caía
-- en la misma lista que "contesta tu encuesta", entre 1.178 notificaciones de las que 272 son
-- recordatorios sin leer.
--
-- Un aviso crítico:
--   · va SIEMPRE arriba en la campana, no en orden cronológico;
--   · sigue visible aunque esté leído, mientras la causa siga viva.
--
-- ============================================================================
-- CÓMO SE SABE QUE LA CAUSA SIGUE VIVA (sin inventar un estado que mantener)
-- ============================================================================
--
-- No hay tabla de "incidencias abiertas" ni nada que haya que cerrar a mano — eso sería otro
-- estado que se queda desincronizado. Se aprovecha algo que ya pasa: **las tareas de fondo
-- vuelven a crear el aviso cada día mientras el problema exista**. Así que un crítico se
-- considera vigente si se ha vuelto a emitir en las últimas 48 h. Cuando el problema se
-- arregla, la tarea deja de emitirlo y el aviso se despega solo al día siguiente.
--
-- El estado real y sin retardo está en `estado_del_sistema()` (migración 109). Esto es solo
-- para que la campana no entierre lo urgente.
--
-- ============================================================================

alter table public.notificaciones
  add column if not exists critica boolean not null default false;

-- Los que ya existen y son de tipos que hoy solo se emiten cuando algo está roto. Se marcan
-- para que el aviso del respaldo que lleva días sonando aparezca destacado desde el primer
-- despliegue, sin esperar a que la tarea lo vuelva a emitir mañana.
update public.notificaciones
   set critica = true
 where tipo = 'respaldo'
   and creada_en > now() - interval '48 hours';

-- La campana pide "las críticas vigentes" y "las últimas N": este índice sirve a las dos.
create index if not exists idx_notificaciones_criticas
  on public.notificaciones (empleado_id, critica, creada_en desc)
  where critica;

comment on column public.notificaciones.critica is
  'Algo está roto y seguirá roto hasta que alguien actúe. La campana lo fija arriba y lo '
  'mantiene visible aunque esté leído mientras se siga emitiendo (ventana de 48 h). '
  'Marcar como leído NO lo resuelve: esa confusión es justo lo que dejó el respaldo externo '
  'seis días caído con los avisos leídos.';
