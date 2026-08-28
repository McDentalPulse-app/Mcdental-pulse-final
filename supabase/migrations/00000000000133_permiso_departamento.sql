-- Permiso "jefe de departamento" — mismo patrón exacto que puede_gestionar_inventario /
-- puede_gestionar_bodega (migración 120) y puede_ubicar_sucursal (migración 103):
-- booleano en usuarios, activable persona por persona desde el modal de edición en
-- GestionUsuarios.jsx. Quien lo tenga puede crear un departamento propio y liderarlo.
--
-- No hace falta protegerlo de auto-otorgamiento: el trigger
-- prevent_usuario_privilege_escalation (migración 103) ya impide que quien no es gestión
-- cambie de su propia fila nada que no sea avatar_url/banner_url.

alter table public.usuarios
  add column if not exists puede_crear_departamento boolean not null default false;

comment on column public.usuarios.puede_crear_departamento is
  'Puede crear un departamento propio y liderarlo (asignar tareas, mandar avisos al grupo). Se otorga desde gestión.';

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select puede_crear_departamento from public.usuarios limit 1;  -> false por defecto.
--
-- ROLLBACK:
--   alter table public.usuarios drop column if exists puede_crear_departamento;
-- ----------------------------------------------------------------------------
