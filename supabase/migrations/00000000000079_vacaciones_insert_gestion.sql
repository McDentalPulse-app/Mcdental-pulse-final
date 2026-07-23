-- ============================================================================
-- Alinea la política de INSERT de vacaciones con la de permisos: gestión
-- (admin/rh/psicologa) puede registrar vacaciones (para sí o para otros, en cualquier estado).
--
-- Motivo: RH y la psicóloga (jefa de RH) necesitan poder AGENDARSE sus propias vacaciones —
-- ya aprobadas, sin pasar por una aprobación aparte. Con la política anterior solo 'rh' podía
-- insertar libremente; la psicóloga quedaba limitada a "propio + pendiente + origen empleado",
-- así que no podía auto-agendarse. Los permisos ya permitían a los tres roles (mig 038); esto
-- deja vacaciones igual de consistente.
-- ============================================================================

drop policy if exists vacaciones_insert_own_or_rh on public.vacaciones;

create policy vacaciones_insert_own_or_gestion on public.vacaciones
  for insert with check (
    (select public.current_role()) in ('admin', 'rh', 'psicologa')
    or (
      empleado_id = (select public.current_usuario_id())
      and estado = 'pendiente'
      and origen = 'empleado'
    )
  );
