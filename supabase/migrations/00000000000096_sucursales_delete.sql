-- sucursales: permitir eliminar.
--
-- La tabla no tenía NINGUNA policy de DELETE, así que borrar una sucursal era imposible
-- para todos los roles, admin incluido: RLS no da error, simplemente el delete no afecta
-- filas. En la app tampoco había botón, así que el límite pasaba desapercibido.
--
-- Se abre a los mismos roles que ya pueden insertar y actualizar (migración 050):
-- admin, rh y psicologa.
--
-- Integridad: el borrado sigue estando frenado donde importa.
--   · asistencias.sucursal_id es FK sin ON DELETE, así que Postgres rechaza (23503) borrar
--     una sucursal con checadas registradas. No se pierde historial de asistencia.
--   · usuarios.sucursal es TEXTO con el nombre, sin FK, así que la base no protege nada:
--     esa comprobación vive en eliminarSucursal() del frontend, que cuenta los empleados
--     asignados y aborta antes de intentar el delete.

drop policy if exists sucursales_delete_gestion on public.sucursales;

create policy sucursales_delete_gestion
  on public.sucursales for delete
  using ((select public.current_role()) in ('admin', 'rh', 'psicologa'));
