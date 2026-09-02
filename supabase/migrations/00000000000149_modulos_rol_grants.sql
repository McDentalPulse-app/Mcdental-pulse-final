-- ============================================================================
-- Hotfix: faltaba el GRANT de tabla en modulos_rol (mig. 147).
--
-- RLS por sí sola no basta — Postgres exige el GRANT además de la policy. Sin
-- esto, CUALQUIER consulta que toque la tabla falla con "permission denied"
-- (PostgREST lo devuelve como 403) — y como avisos/encuestas/comisiones ahora
-- consultan modulos_rol DENTRO de su propia política restrictive (mig. 148),
-- el error se propagó a los tres: nadie podía leer avisos, encuestas ni
-- comisiones desde que se desplegó, no solo el nuevo panel.
-- ============================================================================

-- select para todos (arman su propio menú); insert/update también para todos a nivel de
-- GRANT — la policy modulos_rol_write_admin_plus (mig. 147) es la que de verdad restringe
-- quién puede escribir, mismo patrón que comisiones (mig. 074).
grant select, insert, update on public.modulos_rol to authenticated;
grant select, insert, update, delete on public.modulos_rol to service_role;
