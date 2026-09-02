-- ============================================================================
-- Interruptor GLOBAL por rol (además del que ya existe por persona).
--
-- Pedido del dueño: la barra de Admin+ pasa a navegar por rol (Usuario/Doctor/RH/
-- Psicóloga/Admin) y cada ítem de esos menús lleva un interruptor que lo prende o
-- apaga para TODOS los de ese rol de una — no persona por persona, eso ya lo hace
-- ModulosPanel (mig. 141-143) y sigue existiendo aparte.
--
-- Se SUMA (decisión del dueño) al control por persona: para los 6 módulos que ya
-- tienen candado real, hace falta que el ROL lo tenga prendido Y la persona
-- también (AND) — ver migración 148.
--
-- Ausente = prendido (default true): nadie pierde acceso al desplegar esto.
-- ============================================================================

create table public.modulos_rol (
  role      public.rol_usuario not null,
  item_key  text not null,
  activo    boolean not null default true,
  primary key (role, item_key)
);

alter table public.modulos_rol enable row level security;

-- Config no sensible (solo dice qué pantalla existe para qué rol) y hace falta que
-- CUALQUIER autenticado la lea para armar su propio menú.
create policy modulos_rol_select_todos on public.modulos_rol
  for select using (true);

-- Escribir queda reservado a Admin+ — es quien administra los roles/módulos ajenos.
create policy modulos_rol_write_admin_plus on public.modulos_rol
  for all
  using (public.rol_real() = 'admin_plus')
  with check (public.rol_real() = 'admin_plus');
