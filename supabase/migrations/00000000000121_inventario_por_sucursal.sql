-- Inventario por clínica (plan: inventario-clinicas).
--
-- Tres tablas:
--   `materiales`            catálogo (lo mantiene admin/bodega, no cada recepcionista).
--   `inventario_sucursal`   stock actual por clínica. Nunca se escribe directo: solo la mueve
--                           el trigger de abajo, a partir de `inventario_movimientos`.
--   `inventario_movimientos` cada entrada (bodega), consumo (recepción) o ajuste, con quién y
--                           cuándo — es la mitad de la bitácora que no depende de los pedidos.
--
-- El umbral de stock bajo es POR MATERIAL, global para las 26 clínicas (decisión del dueño):
-- una sola columna en `materiales`, no una tabla puente por sucursal.

create table if not exists public.materiales (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null unique,
  unidad_medida      text not null,
  umbral_stock_bajo  numeric not null default 0 check (umbral_stock_bajo >= 0),
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_materiales_updated_at on public.materiales;
create trigger trg_materiales_updated_at
  before update on public.materiales
  for each row execute function public.set_updated_at();

alter table public.materiales enable row level security;

-- Lectura: cualquier autenticado (recepción necesita ver el catálogo para poder pedir).
drop policy if exists materiales_select_autenticados on public.materiales;
create policy materiales_select_autenticados
  on public.materiales for select
  using ((select public.current_role()) is not null);

-- Escritura: admin o quien tenga puede_gestionar_bodega. Sin policy de DELETE — un material
-- con movimientos históricos no se borra, se desactiva (activo = false), igual que sucursales.
drop policy if exists materiales_insert_gestion on public.materiales;
create policy materiales_insert_gestion
  on public.materiales for insert
  with check (
    (select public.current_role()) = 'admin'
    or (select u.puede_gestionar_bodega from public.usuarios u
        where u.id = (select public.current_usuario_id()))
  );

drop policy if exists materiales_update_gestion on public.materiales;
create policy materiales_update_gestion
  on public.materiales for update
  using (
    (select public.current_role()) = 'admin'
    or (select u.puede_gestionar_bodega from public.usuarios u
        where u.id = (select public.current_usuario_id()))
  )
  with check (
    (select public.current_role()) = 'admin'
    or (select u.puede_gestionar_bodega from public.usuarios u
        where u.id = (select public.current_usuario_id()))
  );

grant select, insert, update on public.materiales to authenticated;
grant select, insert, update on public.materiales to service_role;

-- ============================================================================

create table if not exists public.inventario_sucursal (
  sucursal_id     uuid not null references public.sucursales(id) on delete cascade,
  material_id     uuid not null references public.materiales(id) on delete cascade,
  cantidad_actual numeric not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (sucursal_id, material_id)
);

comment on table public.inventario_sucursal is
  'Stock actual por clínica y material. Se escribe SOLO desde el trigger de '
  'inventario_movimientos (aplicar_movimiento_inventario) — nunca directo desde el cliente.';

alter table public.inventario_sucursal enable row level security;

-- SELECT: admin y bodega ven todas las clínicas; quien tenga puede_gestionar_inventario ve
-- solo la suya (mismo criterio de "sucursal por nombre" que ya usa fijar_geocerca_mi_sucursal).
-- Sin ese permiso, ninguna fila — un `empleado` normal no ve inventario aunque tenga sucursal.
drop policy if exists inventario_sucursal_select on public.inventario_sucursal;
create policy inventario_sucursal_select
  on public.inventario_sucursal for select
  using (
    (select public.current_role()) = 'admin'
    or (select u.puede_gestionar_bodega from public.usuarios u
        where u.id = (select public.current_usuario_id()))
    or (
      (select u.puede_gestionar_inventario from public.usuarios u
        where u.id = (select public.current_usuario_id()))
      and sucursal_id = (
        select s.id from public.sucursales s
        join public.usuarios u on u.sucursal = s.nombre
        where u.id = (select public.current_usuario_id())
      )
    )
  );

-- Sin policy de INSERT/UPDATE/DELETE para `authenticated`: la tabla solo la mueve el trigger,
-- que corre como definer (postgres) y no necesita permiso de fila.
grant select on public.inventario_sucursal to authenticated;
grant select, insert, update, delete on public.inventario_sucursal to service_role;

-- ============================================================================

create table if not exists public.inventario_movimientos (
  id             uuid primary key default gen_random_uuid(),
  sucursal_id    uuid not null references public.sucursales(id) on delete cascade,
  material_id    uuid not null references public.materiales(id) on delete cascade,
  -- signo: 'entrega' y 'ajuste' positivo SUMAN; 'consumo' y 'ajuste' negativo RESTAN.
  -- No se separa un `ajuste_positivo`/`ajuste_negativo`: el signo de `cantidad` ya lo dice.
  tipo           text not null check (tipo in ('entrega', 'consumo', 'ajuste')),
  cantidad       numeric not null check (cantidad <> 0),
  pedido_id      uuid,  -- FK a pedidos se agrega en la migración 122 (pedidos aún no existe aquí)
  registrado_por uuid references public.usuarios(id) on delete set null,
  nota           text,
  creada_en      timestamptz not null default now()
);

create index if not exists idx_inventario_movimientos_sucursal_material
  on public.inventario_movimientos (sucursal_id, material_id, creada_en desc);

comment on table public.inventario_movimientos is
  'Cada entrada/consumo/ajuste de stock. Es la mitad de la bitácora de inventario que no '
  'depende de un pedido (la otra mitad es pedido_estado_log, migración 122).';

alter table public.inventario_movimientos enable row level security;

-- SELECT: mismo criterio que inventario_sucursal.
drop policy if exists inventario_movimientos_select on public.inventario_movimientos;
create policy inventario_movimientos_select
  on public.inventario_movimientos for select
  using (
    (select public.current_role()) = 'admin'
    or (select u.puede_gestionar_bodega from public.usuarios u
        where u.id = (select public.current_usuario_id()))
    or (
      (select u.puede_gestionar_inventario from public.usuarios u
        where u.id = (select public.current_usuario_id()))
      and sucursal_id = (
        select s.id from public.sucursales s
        join public.usuarios u on u.sucursal = s.nombre
        where u.id = (select public.current_usuario_id())
      )
    )
  );

-- INSERT directo desde el cliente: SOLO 'consumo', SOLO de la propia sucursal, SOLO quien
-- tenga el permiso. 'entrega' y 'ajuste' (bodega) van por la RPC de la migración 122 —una
-- función security definer no necesita policy de INSERT, corre como el dueño de la tabla.
drop policy if exists inventario_movimientos_insert_consumo on public.inventario_movimientos;
create policy inventario_movimientos_insert_consumo
  on public.inventario_movimientos for insert
  with check (
    tipo = 'consumo'
    and cantidad < 0
    and registrado_por = (select public.current_usuario_id())
    and (select u.puede_gestionar_inventario from public.usuarios u
        where u.id = (select public.current_usuario_id()))
    and sucursal_id = (
      select s.id from public.sucursales s
      join public.usuarios u on u.sucursal = s.nombre
      where u.id = (select public.current_usuario_id())
    )
  );

grant select, insert on public.inventario_movimientos to authenticated;
grant select, insert, update, delete on public.inventario_movimientos to service_role;

-- ============================================================================
-- El trigger que hace que todo lo anterior sea cierto: aplica el movimiento al stock y avisa
-- si cruza el umbral. Sin esto, `inventario_sucursal` no se movería nunca.
-- ============================================================================

create or replace function public.aplicar_movimiento_inventario()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_anterior numeric;
  v_nuevo    numeric;
  v_umbral   numeric;
begin
  select cantidad_actual into v_anterior
    from public.inventario_sucursal
   where sucursal_id = new.sucursal_id and material_id = new.material_id;

  insert into public.inventario_sucursal (sucursal_id, material_id, cantidad_actual, updated_at)
  values (new.sucursal_id, new.material_id, new.cantidad, now())
  on conflict (sucursal_id, material_id) do update
    set cantidad_actual = public.inventario_sucursal.cantidad_actual + excluded.cantidad_actual,
        updated_at = now()
  returning cantidad_actual into v_nuevo;

  select umbral_stock_bajo into v_umbral from public.materiales where id = new.material_id;

  -- Solo avisa al CRUZAR el umbral hacia abajo, no en cada consumo mientras ya está bajo:
  -- si no, un consumo diario chico dispararía la misma alerta todos los días.
  if v_umbral is not null and v_nuevo <= v_umbral
     and (v_anterior is null or v_anterior > v_umbral) then
    insert into public.notificaciones (empleado_id, tipo, titulo, cuerpo)
    select u.id, 'inventario',
           'Stock bajo: ' || m.nombre || ' en ' || s.nombre,
           'Quedan ' || v_nuevo || ' ' || m.unidad_medida
      from public.usuarios u
      cross join public.materiales m
      cross join public.sucursales s
     where m.id = new.material_id
       and s.id = new.sucursal_id
       and coalesce(u.inactivo, false) = false
       and (u.puede_gestionar_bodega or u.role = 'admin');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventario_movimientos_aplicar on public.inventario_movimientos;
create trigger trg_inventario_movimientos_aplicar
  after insert on public.inventario_movimientos
  for each row execute function public.aplicar_movimiento_inventario();

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (local):
--   insert into materiales (nombre, unidad_medida, umbral_stock_bajo) values ('Guantes L', 'caja', 5);
--   insert into inventario_movimientos (sucursal_id, material_id, tipo, cantidad, registrado_por)
--     values (<sucursal>, <material>, 'entrega', 10, <admin>);
--   -> inventario_sucursal queda en 10.
--   insert ... ('consumo', -6, ...) -> queda en 4, y dispara una notificación (4 <= 5).
--   insert ... ('consumo', -1, ...) -> queda en 3, SIN notificación nueva (ya estaba bajo).
--   (como empleado sin puede_gestionar_inventario) insert ... 'consumo' -> RLS lo rechaza.
--
-- ROLLBACK:
--   drop trigger if exists trg_inventario_movimientos_aplicar on public.inventario_movimientos;
--   drop function if exists public.aplicar_movimiento_inventario();
--   drop table if exists public.inventario_movimientos;
--   drop table if exists public.inventario_sucursal;
--   drop table if exists public.materiales;
-- ----------------------------------------------------------------------------
