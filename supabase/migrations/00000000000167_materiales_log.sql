-- Bitácora del CATÁLOGO de materiales: crear, editar, activar/inactivar y eliminar.
--
-- `inventario_movimientos` (migración 121) es la bitácora de STOCK (entrega/consumo/ajuste):
-- cuánto sube o baja en una clínica. No sirve para esto — sus filas cuelgan de `material_id`
-- con `on delete cascade`, así que si se usara para loguear "eliminado" el propio evento
-- desaparecería junto con el material que lo causó. Necesita una tabla aparte, sin esa cascada.
--
-- Mismo patrón que `pedido_estado_log` (migración 122) y `sucursal_geocerca_log` (103): se
-- llena SOLA por trigger, nunca por código de aplicación — así ninguna vía de edición del
-- catálogo (la UI de hoy, un script futuro, otro desarrollador) puede olvidar loguear.
--
-- `material_id` va SIN foreign key a propósito: por eso sobrevive al `on delete cascade` que
-- borra a `materiales` de verdad (decisión del dueño, migración 125). `material_nombre` es una
-- foto del nombre al momento del evento — para "eliminado", es la única forma de saber después
-- qué material era, porque la fila de `materiales` ya no está.

create table if not exists public.materiales_log (
  id              uuid primary key default gen_random_uuid(),
  material_id     uuid not null,
  material_nombre text not null,
  accion          text not null check (accion in ('creado', 'editado', 'activado', 'inactivado', 'eliminado')),
  detalle         text,
  realizado_por   uuid references public.usuarios(id) on delete set null,
  creada_en       timestamptz not null default now()
);

create index if not exists idx_materiales_log_creada_en on public.materiales_log (creada_en desc);

comment on table public.materiales_log is
  'Bitácora del catálogo de materiales (crear/editar/activar/inactivar/eliminar). Se llena '
  'sola por trigger sobre public.materiales. No confundir con inventario_movimientos '
  '(migración 121), que es la bitácora de STOCK.';

alter table public.materiales_log enable row level security;

-- Mismo criterio que quien administra el catálogo (materiales_update_gestion, migración 121):
-- admin o puede_gestionar_bodega. Recepción gestiona STOCK, no el catálogo, así que no ve esto
-- (además de que nunca podría causar ninguno de estos eventos).
drop policy if exists materiales_log_select on public.materiales_log;
create policy materiales_log_select
  on public.materiales_log for select
  using (
    (select public.current_role()) = 'admin'
    or (select u.puede_gestionar_bodega from public.usuarios u
        where u.id = (select public.current_usuario_id()))
  );

-- Sin policy de INSERT/UPDATE/DELETE para `authenticated`: solo el trigger (security definer)
-- escribe aquí. Así ni el propio admin puede insertar una fila falsa o borrar una entrada
-- incómoda desde el cliente — es un registro de auditoría, no una tabla editable.
grant select on public.materiales_log to authenticated;
grant select, insert on public.materiales_log to service_role;

-- ============================================================================
-- El trigger que hace que todo lo anterior sea cierto.
-- ============================================================================

create or replace function public.log_materiales_cambio()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario uuid;
  v_cambios text[] := '{}';
begin
  v_usuario := public.current_usuario_id();

  if TG_OP = 'INSERT' then
    insert into public.materiales_log (material_id, material_nombre, accion, realizado_por)
    values (new.id, new.nombre, 'creado', v_usuario);
    return new;
  end if;

  if TG_OP = 'DELETE' then
    -- AFTER DELETE, no BEFORE: material_id no lleva FK a materiales, así que no hay cascada
    -- que evitar. Con AFTER, si algo más en la transacción revierte el borrado, esta fila se
    -- revierte también — con BEFORE quedaría huérfana aunque el DELETE no llegara a pasar.
    insert into public.materiales_log (material_id, material_nombre, accion, realizado_por)
    values (old.id, old.nombre, 'eliminado', v_usuario);
    return old;
  end if;

  -- TG_OP = 'UPDATE'. Activar/inactivar se loguea aparte de "editado": es el cambio que más le
  -- importa a quien lee la bitácora (saca o mete el material de pedidos y consumo), no debe
  -- quedar escondido dentro de una línea genérica de "se editó algo".
  if new.activo is distinct from old.activo then
    insert into public.materiales_log (material_id, material_nombre, accion, realizado_por)
    values (new.id, new.nombre, case when new.activo then 'activado' else 'inactivado' end, v_usuario);
  end if;

  if new.nombre is distinct from old.nombre then
    v_cambios := v_cambios || format('nombre: "%s" → "%s"', old.nombre, new.nombre);
  end if;
  if new.unidad_medida is distinct from old.unidad_medida then
    v_cambios := v_cambios || format('unidad: "%s" → "%s"', old.unidad_medida, new.unidad_medida);
  end if;
  if new.umbral_stock_bajo is distinct from old.umbral_stock_bajo then
    v_cambios := v_cambios || format('umbral de aviso: %s → %s', old.umbral_stock_bajo, new.umbral_stock_bajo);
  end if;
  if new.imagen_url is distinct from old.imagen_url then
    v_cambios := v_cambios || 'foto actualizada';
  end if;

  if array_length(v_cambios, 1) > 0 then
    insert into public.materiales_log (material_id, material_nombre, accion, detalle, realizado_por)
    values (new.id, new.nombre, 'editado', array_to_string(v_cambios, '; '), v_usuario);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_materiales_log on public.materiales;
create trigger trg_materiales_log
  after insert or update or delete on public.materiales
  for each row execute function public.log_materiales_cambio();

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (local):
--   insert into materiales (nombre, unidad_medida, umbral_stock_bajo) values ('X', 'caja', 5);
--     -> 1 fila en materiales_log, accion='creado'.
--   update materiales set activo = false where nombre = 'X';
--     -> 1 fila accion='inactivado'.
--   update materiales set nombre = 'Y', umbral_stock_bajo = 8 where nombre... ;
--     -> 1 fila accion='editado', detalle con las dos diferencias.
--   delete from materiales where nombre = 'Y';
--     -> 1 fila accion='eliminado' que SOBREVIVE al borrado (material_id ya no resuelve en
--        materiales, pero material_nombre sigue legible).
--   (como recepción con puede_gestionar_inventario, sin bodega) select * from materiales_log;
--     -> 0 filas, RLS lo vacía en vez de dar error.
--
-- ROLLBACK:
--   drop trigger if exists trg_materiales_log on public.materiales;
--   drop function if exists public.log_materiales_cambio();
--   drop table if exists public.materiales_log;
-- ----------------------------------------------------------------------------
