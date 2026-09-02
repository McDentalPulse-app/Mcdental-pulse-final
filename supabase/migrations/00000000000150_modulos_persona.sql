-- ============================================================================
-- Interruptor por PERSONA para cualquier ítem del menú (además del interruptor
-- global por rol, mig. 147-148, y los 6 ítems que ya tenían columna dedicada
-- desde antes — comisiones/checador/notas/departamentos/avisos/encuestas, que
-- NO entran aquí, siguen con su columna tal cual).
--
-- Pedido del dueño: Admin+ tiene que poder prenderle/apagarle CUALQUIER módulo
-- a CUALQUIER persona en particular, no solo esos 6.
--
-- Ausente = prendido (default true): nadie pierde acceso al desplegar esto.
--
-- El GRANT va en este MISMO archivo, no en uno aparte — la migración 147
-- (modulos_rol) salió sin él y tumbó avisos/encuestas/comisiones en producción
-- durante un rato (RLS sola no alcanza, Postgres exige el GRANT de tabla
-- además de la policy; el error se propaga a cualquier política que consulte
-- esta tabla por dentro).
-- ============================================================================

create table public.modulos_persona (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  item_key   text not null,
  activo     boolean not null default true,
  primary key (usuario_id, item_key)
);

alter table public.modulos_persona enable row level security;

-- Cada quien lee sus propias filas (para armar su menú); admin/admin_plus leen todas
-- (current_role() pliega admin_plus -> admin). A propósito más ancho que ESCRIBIR (que sí
-- es solo Admin+ real, abajo): es la misma info que admin ya ve de sobra en otros lados
-- (quién tiene qué permiso, en GestionUsuarios), no algo nuevo que esconderle.
create policy modulos_persona_select on public.modulos_persona
  for select using (
    usuario_id = public.current_usuario_id()
    or public.current_role() = 'admin'
  );

-- Escribir queda reservado a Admin+ real (no admin normal, ni siquiera sobre
-- la fila propia) — mismo criterio que modulos_rol. El "ni siquiera sobre la fila propia"
-- para 'modulos' es candado de verdad, no solo de UI (ModulosPanel.jsx ya excluye su propia
-- cuenta de la lista, pero eso es cliente — esto lo bloquea aunque alguien llame al RPC
-- directo): sin él, Admin+ podría apagarse a sí mismo la única pantalla que administra esto.
create policy modulos_persona_write_admin_plus on public.modulos_persona
  for all
  using (public.rol_real() = 'admin_plus')
  with check (
    public.rol_real() = 'admin_plus'
    and not (usuario_id = public.current_usuario_id() and item_key = 'modulos')
  );

grant select, insert, update on public.modulos_persona to authenticated;
grant select, insert, update, delete on public.modulos_persona to service_role;
