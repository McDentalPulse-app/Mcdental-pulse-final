-- Corrige un descuido de la migración 052.
--
-- La 052 creó `rostros_insert_gestion` y `rostros_update_gestion` sobre `public.rostros`,
-- calcando el patrón de `rostros_select_gestion`. Pero a diferencia del SELECT, esa tabla NUNCA
-- tuvo un `grant insert, update ... to authenticated` (migración 041: solo
-- `grant select on public.rostros to authenticated`; insert/update quedaron solo para
-- `service_role`, porque todo el enrolado y la aprobación pasan por api/enrolar-rostro.js y
-- api/aprobar-rostro.js con la service role, nunca por un insert/update directo del cliente).
--
-- Sin el GRANT, Postgres niega el permiso ANTES de mirar la policy — exactamente la trampa que
-- ya documentó la migración 047 para cotejo_intentos. Las dos policies de la 052 nunca se van a
-- ejecutar: son ruido inofensivo, pero confunden a quien lea las policies pensando que el
-- cliente puede escribir ahí directo. Se quitan. La de SELECT (rostros_select_gestion) sí tenía
-- su GRANT correspondiente y se queda igual.

drop policy if exists rostros_insert_gestion on public.rostros;
drop policy if exists rostros_update_gestion on public.rostros;

-- ----------------------------------------------------------------------------
-- Rollback
-- ----------------------------------------------------------------------------
--   create policy rostros_insert_gestion on public.rostros for insert
--     with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));
--   create policy rostros_update_gestion on public.rostros for update
--     using ((select public.current_role()) in ('admin', 'rh', 'psicologa'))
--     with check ((select public.current_role()) in ('admin', 'rh', 'psicologa'));
