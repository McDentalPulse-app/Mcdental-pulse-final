-- Admin y psicóloga también pueden dar de alta una checada manual ("marcar como
-- retardo" en el panel de Asistencia), no solo rh (decisión del dueño, 2026-09-19).
-- Mismo patrón que la migración 060 (update ampliado a admin/rh): se SUELTA y
-- RECREA la policy afectada en vez de editar la ya aplicada.

drop policy if exists asistencias_insert_rh on public.asistencias;
create policy asistencias_insert_gestion
  on public.asistencias for insert
  with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));
