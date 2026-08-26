-- Dos permisos booleanos para el inventario por clínica (plan: inventario-clinicas).
--
-- Van primero porque las RLS de las tablas de inventario y pedidos (migraciones 114/115) ya
-- los usan. Mismo patrón exacto que `puede_ubicar_sucursal` (migración 103) y `soporte_ti`
-- (migración 094): booleano sobre `usuarios`, activable persona por persona desde el modal de
-- edición en GestionUsuarios.jsx. No se cuelga de `puesto` (texto libre, ya con tres grafías
-- de "Recepcionista") ni se crea un rol nuevo: el dueño pidió que ambos sean activables uno
-- por uno, igual que ya se hizo con soporte_ti.
--
-- `puede_gestionar_bodega`     — ve y procesa los pedidos de TODAS las sucursales.
-- `puede_gestionar_inventario` — ve el inventario de SU sucursal, registra consumo, pide.

alter table public.usuarios
  add column if not exists puede_gestionar_bodega     boolean not null default false,
  add column if not exists puede_gestionar_inventario  boolean not null default false;

comment on column public.usuarios.puede_gestionar_bodega is
  'Ve y procesa los pedidos de material de todas las sucursales. Se otorga desde gestión.';
comment on column public.usuarios.puede_gestionar_inventario is
  'Ve el inventario de su propia sucursal, registra consumo y hace pedidos. Se otorga desde gestión.';

-- No hace falta protegerlos de auto-otorgamiento: el trigger
-- prevent_usuario_privilege_escalation ya impide que quien no es gestión cambie de su propia
-- fila nada que no sea avatar_url o banner_url (ver migración 103, mismo razonamiento).

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN:
--   select puede_gestionar_bodega, puede_gestionar_inventario from public.usuarios limit 1;
--     -> ambas en false por defecto.
--
-- ROLLBACK:
--   alter table public.usuarios
--     drop column if exists puede_gestionar_bodega,
--     drop column if exists puede_gestionar_inventario;
-- ----------------------------------------------------------------------------
