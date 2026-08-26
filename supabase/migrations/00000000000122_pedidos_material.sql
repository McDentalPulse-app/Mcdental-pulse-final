-- Pedidos de material (plan: inventario-clinicas).
--
-- Un pedido = una cabecera (`pedidos`) + varias líneas (`pedido_items`), decisión ya tomada con
-- el dueño (lista de varios materiales, no un pedido por material). Dos orígenes en la misma
-- tabla: `recepcion` (pide para SU clínica) y `admin` (pedido especial, marcado distinto para
-- que bodega lo vea como "pedido directo del admin" — es el campo `origen`, no una tabla aparte).
--
-- `enviado` es el estado FINAL (decisión ya tomada): bodega decide cuánto manda por línea y en
-- ese mismo momento sube el inventario de la clínica. No hay paso de "confirmar recepción".
--
-- Todo insert/actualización de estado pasa por RPC, no por policy de columna: mismo motivo que
-- `fijar_geocerca_mi_sucursal` (migración 103) — una policy no distingue columnas, y ni
-- recepción debe poder tocar `origen`/`sucursal_id` de un pedido ajeno, ni bodega debe poder
-- tocar nada salvo el estado y lo que envía.

create table if not exists public.pedidos (
  id                     uuid primary key default gen_random_uuid(),
  sucursal_id            uuid not null references public.sucursales(id) on delete restrict,
  solicitado_por         uuid not null references public.usuarios(id) on delete restrict,
  origen                 text not null check (origen in ('recepcion', 'admin')),
  estado                 text not null default 'pendiente'
                           check (estado in ('pendiente', 'enviado', 'rechazado', 'cancelado')),
  fecha_estimada_entrega date,
  comentario             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_pedidos_sucursal on public.pedidos (sucursal_id, created_at desc);
create index if not exists idx_pedidos_estado on public.pedidos (estado) where estado = 'pendiente';

drop trigger if exists trg_pedidos_updated_at on public.pedidos;
create trigger trg_pedidos_updated_at
  before update on public.pedidos
  for each row execute function public.set_updated_at();

create table if not exists public.pedido_items (
  id                   uuid primary key default gen_random_uuid(),
  pedido_id            uuid not null references public.pedidos(id) on delete cascade,
  material_id          uuid not null references public.materiales(id) on delete restrict,
  cantidad_solicitada  numeric not null check (cantidad_solicitada > 0),
  -- null hasta que bodega decide; puede ser MENOR a la solicitada (envío parcial) — así es
  -- como "bodega ve la diferencia y decide si enviar o no" queda registrado, no solo declarado.
  cantidad_enviada     numeric check (cantidad_enviada is null or cantidad_enviada >= 0)
);

create index if not exists idx_pedido_items_pedido on public.pedido_items (pedido_id);

-- Ahora que pedidos existe, la FK que quedó pendiente en la migración 121.
alter table public.inventario_movimientos
  add constraint inventario_movimientos_pedido_id_fkey
  foreign key (pedido_id) references public.pedidos(id) on delete set null;

create table if not exists public.pedido_estado_log (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  estado_anterior text not null,
  estado_nuevo    text not null,
  cambiado_por    uuid references public.usuarios(id) on delete set null,
  cambiado_en     timestamptz not null default now()
);

create index if not exists idx_pedido_estado_log_pedido
  on public.pedido_estado_log (pedido_id, cambiado_en desc);

comment on table public.pedido_estado_log is
  'Bitácora de cambios de estado de cada pedido (mitad 2 de 2 — la otra es '
  'inventario_movimientos, migración 121). Se llena sola por trigger, mismo patrón que '
  'sucursal_geocerca_log (migración 103): no depende de que el código que actualiza el '
  'estado se acuerde de loguear.';

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.pedido_estado_log enable row level security;

-- SELECT pedidos: admin ve todo; bodega ve todo (necesita ver los pedidos de las 26 clínicas);
-- quien tenga puede_gestionar_inventario ve solo los de su sucursal.
drop policy if exists pedidos_select on public.pedidos;
create policy pedidos_select
  on public.pedidos for select
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

-- Sin policy de INSERT ni de UPDATE para `authenticated`: crear_pedido() y
-- bodega_procesar_pedido() (abajo) son security definer y no las necesitan. Así ni recepción
-- puede nombrar otra sucursal, ni bodega puede tocar una columna que no sea la que le toca.
grant select on public.pedidos to authenticated;
grant select, insert, update, delete on public.pedidos to service_role;

drop policy if exists pedido_items_select on public.pedido_items;
create policy pedido_items_select
  on public.pedido_items for select
  using (exists (
    select 1 from public.pedidos p where p.id = pedido_items.pedido_id
    -- reutiliza exactamente el mismo criterio que pedidos_select, vía el permiso de la fila
    -- padre: si se puede ver el pedido, se pueden ver sus líneas.
  ));

grant select on public.pedido_items to authenticated;
grant select, insert, update, delete on public.pedido_items to service_role;

drop policy if exists pedido_estado_log_select on public.pedido_estado_log;
create policy pedido_estado_log_select
  on public.pedido_estado_log for select
  using (
    (select public.current_role()) = 'admin'
    or (select u.puede_gestionar_bodega from public.usuarios u
        where u.id = (select public.current_usuario_id()))
    or exists (
      select 1 from public.pedidos p
       where p.id = pedido_estado_log.pedido_id
         and p.solicitado_por = (select public.current_usuario_id())
    )
  );

grant select on public.pedido_estado_log to authenticated;
grant select, insert on public.pedido_estado_log to service_role;

-- ============================================================================
-- Bitácora de estado: se llena sola, igual que sellar_geocerca/log_geocerca (migración 103).
-- ============================================================================

create or replace function public.log_pedido_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.pedido_estado_log (pedido_id, estado_anterior, estado_nuevo, cambiado_por)
    values (new.id, old.estado, new.estado, public.current_usuario_id());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_log_estado on public.pedidos;
create trigger trg_pedidos_log_estado
  after update on public.pedidos
  for each row execute function public.log_pedido_estado();

-- ============================================================================
-- RPC 1: crear pedido (recepción o admin). Cabecera + líneas en una sola transacción: un
-- pedido sin líneas, o líneas sin cabecera, no debe poder existir.
-- ============================================================================

create or replace function public.crear_pedido(
  p_sucursal_id uuid,
  p_items       jsonb,
  p_comentario  text default null
)
returns public.pedidos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario    public.usuarios%rowtype;
  v_origen     text;
  v_sucursal_id uuid;
  v_pedido     public.pedidos%rowtype;
  v_item       jsonb;
begin
  select * into v_usuario from public.usuarios where auth_user_id = auth.uid();
  if v_usuario.id is null then
    raise exception 'Tu sesión expiró. Vuelve a entrar.';
  end if;
  if v_usuario.inactivo or v_usuario.archivado then
    raise exception 'Tu cuenta no está activa.';
  end if;

  if v_usuario.role = 'admin' then
    v_origen := 'admin';
    if p_sucursal_id is null then
      raise exception 'Elige a qué clínica va el pedido.';
    end if;
    v_sucursal_id := p_sucursal_id;
  elsif coalesce(v_usuario.puede_gestionar_inventario, false) then
    v_origen := 'recepcion';
    -- Igual que fijar_geocerca_mi_sucursal: se resuelve DE la propia cuenta, no se recibe
    -- como parámetro nombrable — así no hay forma de pedir a nombre de otra clínica.
    select id into v_sucursal_id from public.sucursales
     where nombre = v_usuario.sucursal and activa = true;
    if v_sucursal_id is null then
      raise exception 'No encontramos tu clínica (%). Avisa a administración.',
        coalesce(v_usuario.sucursal, 'sin asignar');
    end if;
  else
    raise exception 'No tienes permiso para hacer pedidos de material.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido necesita al menos un material.';
  end if;

  insert into public.pedidos (sucursal_id, solicitado_por, origen, comentario)
  values (v_sucursal_id, v_usuario.id, v_origen, p_comentario)
  returning * into v_pedido;

  for v_item in select jsonb_array_elements(p_items) loop
    if (v_item->>'materialId') is null or (v_item->>'cantidad')::numeric <= 0 then
      raise exception 'Cada línea necesita un material y una cantidad mayor a cero.';
    end if;
    insert into public.pedido_items (pedido_id, material_id, cantidad_solicitada)
    values (v_pedido.id, (v_item->>'materialId')::uuid, (v_item->>'cantidad')::numeric);
  end loop;

  return v_pedido;
end;
$$;

grant execute on function public.crear_pedido(uuid, jsonb, text) to authenticated;

-- ============================================================================
-- RPC 2: bodega procesa un pedido pendiente. Decide cuánto envía por línea; si lo envía,
-- suma de una vez el inventario de la clínica (vía inventario_movimientos, migración 121).
-- ============================================================================

create or replace function public.bodega_procesar_pedido(
  p_pedido_id       uuid,
  p_items           jsonb,   -- [{"pedidoItemId": "...", "cantidadEnviada": n}, ...]
  p_estado          text,    -- 'enviado' | 'rechazado' | 'cancelado'
  p_fecha_estimada  date default null
)
returns public.pedidos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario public.usuarios%rowtype;
  v_pedido  public.pedidos%rowtype;
  v_item    jsonb;
begin
  select * into v_usuario from public.usuarios where auth_user_id = auth.uid();
  if v_usuario.id is null then
    raise exception 'Tu sesión expiró. Vuelve a entrar.';
  end if;
  if not coalesce(v_usuario.puede_gestionar_bodega, false) then
    raise exception 'No tienes permiso para procesar pedidos.';
  end if;

  if p_estado not in ('enviado', 'rechazado', 'cancelado') then
    raise exception 'Estado inválido: %', p_estado;
  end if;

  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if v_pedido.id is null then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_pedido.estado <> 'pendiente' then
    raise exception 'Este pedido ya se procesó (estado actual: %).', v_pedido.estado;
  end if;

  if p_estado = 'enviado' then
    if p_items is null or jsonb_array_length(p_items) = 0 then
      raise exception 'Indica cuánto se envía de cada línea.';
    end if;

    for v_item in select jsonb_array_elements(p_items) loop
      update public.pedido_items
         set cantidad_enviada = (v_item->>'cantidadEnviada')::numeric
       where id = (v_item->>'pedidoItemId')::uuid
         and pedido_id = p_pedido_id;

      if (v_item->>'cantidadEnviada')::numeric > 0 then
        insert into public.inventario_movimientos
          (sucursal_id, material_id, tipo, cantidad, pedido_id, registrado_por)
        select v_pedido.sucursal_id, pi.material_id, 'entrega',
               (v_item->>'cantidadEnviada')::numeric, p_pedido_id, v_usuario.id
          from public.pedido_items pi
         where pi.id = (v_item->>'pedidoItemId')::uuid;
      end if;
    end loop;
  end if;

  update public.pedidos
     set estado = p_estado,
         fecha_estimada_entrega = coalesce(p_fecha_estimada, fecha_estimada_entrega)
   where id = p_pedido_id
  returning * into v_pedido;

  return v_pedido;
end;
$$;

grant execute on function public.bodega_procesar_pedido(uuid, jsonb, text, date) to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (local):
--   select crear_pedido(<sucursal>, '[{"materialId":"...","cantidad":10}]'::jsonb, null);
--     -> como recepción de esa clínica: crea pedido 'pendiente' + 1 línea.
--     -> como recepción SIN puede_gestionar_inventario: 'No tienes permiso...'.
--     -> como admin: exige p_sucursal_id, origen queda 'admin'.
--   select bodega_procesar_pedido(<pedido>, '[{"pedidoItemId":"...","cantidadEnviada":6}]'::jsonb,
--     'enviado', null);
--     -> pedido queda 'enviado', inventario_sucursal de esa clínica sube 6, pedido_estado_log
--        tiene una fila pendiente->enviado.
--   Repetir la misma llamada -> 'Este pedido ya se procesó'.
--
-- ROLLBACK:
--   drop function if exists public.bodega_procesar_pedido(uuid, jsonb, text, date);
--   drop function if exists public.crear_pedido(uuid, jsonb, text);
--   drop trigger if exists trg_pedidos_log_estado on public.pedidos;
--   drop function if exists public.log_pedido_estado();
--   drop table if exists public.pedido_estado_log;
--   alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_pedido_id_fkey;
--   drop table if exists public.pedido_items;
--   drop table if exists public.pedidos;
-- ----------------------------------------------------------------------------
