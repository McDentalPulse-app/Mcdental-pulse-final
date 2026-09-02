-- ============================================================================
-- Rol 'admin_plus' (parte 1/3): agregar el valor al enum.
--
-- Nivel arriba de admin, pedido por el dueño: ve/toca todo lo que admin (heredado
-- vía current_role(), migración 139) y además es el único que puede tocar cuentas
-- admin/admin_plus (migración 140).
--
-- ¿Por qué en su propio archivo? Postgres no deja USAR un valor de enum recién
-- agregado dentro de la MISMA transacción que lo crea (mismo motivo que la 072
-- para 'doctor').
-- ============================================================================

alter type public.rol_usuario add value if not exists 'admin_plus';
