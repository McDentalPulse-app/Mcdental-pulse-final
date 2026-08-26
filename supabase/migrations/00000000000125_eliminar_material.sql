-- El dueño pidió poder eliminar un material de verdad en vez de solo desactivarlo (decisión
-- de producto, 2026-08-26 — se le explicó que inventario_sucursal e inventario_movimientos
-- están en `on delete cascade` y se pierden con el material; pedido_items sigue en
-- `on delete restrict` y bloqueará el borrado si el material ya se pidió alguna vez).
--
-- La tabla nunca tuvo GRANT DELETE (solo INSERT/SELECT/UPDATE, migración 121) — sin esto la
-- policy de abajo nunca se evalúa siquiera, y el error es "permission denied for table
-- materiales" en vez de un rechazo de RLS. Mismo patrón que INSERT/UPDATE/SELECT.
grant delete on public.materiales to authenticated;

-- Mismo predicado que materiales_update_gestion (migración 121): admin o quien tenga
-- puede_gestionar_bodega.

create policy materiales_delete_gestion
  on public.materiales for delete
  using (
    (select public.current_role()) = 'admin'
    or (select u.puede_gestionar_bodega from public.usuarios u
        where u.id = (select public.current_usuario_id()))
  );
