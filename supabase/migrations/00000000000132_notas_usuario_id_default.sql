-- ============================================================================
-- Fix: crear una nota daba 403 — el insert nunca mandaba usuario_id (ni el
-- cliente lo ponía, ni la columna tenía default), así que "with check
-- usuario_id = current_usuario_id()" rechazaba SIEMPRE la fila. Migración 132.
-- ============================================================================

alter table public.notas
  alter column usuario_id set default public.current_usuario_id();
