-- Admin también puede anular checadas, no solo RH (decisión del dueño, 2026-07-16).
-- Mismo patrón que la migración 050 (rh/psicologa con paridad de admin): se SUELTA y
-- RECREA la policy afectada en vez de editar la ya aplicada.

drop policy if exists asistencias_update_rh on public.asistencias;
create policy asistencias_update_gestion
  on public.asistencias for update
  using ((select public.current_role()) in ('admin', 'rh'))
  with check ((select public.current_role()) in ('admin', 'rh'));

-- Sigue sin haber policy de DELETE: una checada es un documento laboral. Se anula, no se borra.
