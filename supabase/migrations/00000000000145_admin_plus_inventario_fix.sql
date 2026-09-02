-- ============================================================================
-- Admin+ en los 4 sitios que comprueban `role = 'admin'` directo en vez de
-- current_role() — el pliegue de la migración 139 NO los cubre, así que sin
-- esto un admin_plus se queda AFUERA de: leer el estado del respaldo, el
-- aviso de stock bajo, el pedido "origen admin" y el bypass de bodega/ajuste.
-- Hallazgo de la revisión de correctness de esta feature.
--
-- No se editan los archivos originales (093/121/122/123/126) — son migraciones
-- ya corridas contra la VPS; se redefinen las mismas funciones/policy con
-- CREATE OR REPLACE, igual patrón que 140/141 con el trigger de usuarios.
-- ============================================================================

-- 093: respaldo_latidos — solo cambia la comparación de rol.
drop policy if exists respaldo_latidos_select_admin on public.respaldo_latidos;
create policy respaldo_latidos_select_admin on public.respaldo_latidos
  for select using (
    exists (
      select 1 from public.usuarios u
      where u.id = (select current_usuario_id())
        and u.role in ('admin', 'admin_plus')
    )
  );

-- 121: aplicar_movimiento_inventario() — mismo cuerpo, solo el `u.role = 'admin'`
-- del aviso de stock bajo pasa a incluir admin_plus.
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
       and (u.puede_gestionar_bodega or u.role in ('admin', 'admin_plus'));
  end if;

  return new;
end;
$$;

-- 122: crear_pedido() — mismo cuerpo, solo la rama `role = 'admin'` pasa a
-- incluir admin_plus.
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

  if v_usuario.role in ('admin', 'admin_plus') then
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

-- 123: ajustar_inventario() — mismo cuerpo, solo la rama `role = 'admin'` pasa a
-- incluir admin_plus.
create or replace function public.ajustar_inventario(
  p_sucursal_id uuid,
  p_material_id uuid,
  p_cantidad    numeric,
  p_nota        text default null
)
returns public.inventario_sucursal
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario     public.usuarios%rowtype;
  v_sucursal_id uuid;
  v_actual      numeric;
  v_resultado   public.inventario_sucursal%rowtype;
begin
  select * into v_usuario from public.usuarios where auth_user_id = auth.uid();
  if v_usuario.id is null then
    raise exception 'Tu sesión expiró. Vuelve a entrar.';
  end if;
  if v_usuario.inactivo or v_usuario.archivado then
    raise exception 'Tu cuenta no está activa.';
  end if;

  if p_material_id is null then
    raise exception 'Elige un material.';
  end if;
  if p_cantidad is null or p_cantidad = 0 then
    raise exception 'La cantidad del ajuste no puede ser cero.';
  end if;

  if v_usuario.role in ('admin', 'admin_plus') or coalesce(v_usuario.puede_gestionar_bodega, false) then
    if p_sucursal_id is null then
      raise exception 'Elige a qué clínica va el ajuste.';
    end if;
    v_sucursal_id := p_sucursal_id;
  elsif coalesce(v_usuario.puede_gestionar_inventario, false) then
    select id into v_sucursal_id from public.sucursales
     where nombre = v_usuario.sucursal and activa = true;
    if v_sucursal_id is null then
      raise exception 'No encontramos tu clínica (%). Avisa a administración.',
        coalesce(v_usuario.sucursal, 'sin asignar');
    end if;
  else
    raise exception 'No tienes permiso para ajustar inventario.';
  end if;

  select cantidad_actual into v_actual
    from public.inventario_sucursal
   where sucursal_id = v_sucursal_id and material_id = p_material_id;

  -- El ajuste resta cuando p_cantidad es negativo (mismo signo que 'consumo' y 'entrega',
  -- migración 121): sin esta guarda un ajuste negativo mal escrito manda el stock a números
  -- que no significan nada físicamente.
  if coalesce(v_actual, 0) + p_cantidad < 0 then
    raise exception 'Ese ajuste dejaría el stock en negativo (hay %, quieres restar %).',
      coalesce(v_actual, 0), abs(p_cantidad);
  end if;

  insert into public.inventario_movimientos
    (sucursal_id, material_id, tipo, cantidad, registrado_por, nota)
  values (v_sucursal_id, p_material_id, 'ajuste', p_cantidad, v_usuario.id, p_nota);

  select * into v_resultado from public.inventario_sucursal
   where sucursal_id = v_sucursal_id and material_id = p_material_id;

  return v_resultado;
end;
$$;

-- 126: bodega_procesar_pedido() — mismo cuerpo, solo el `role <> 'admin'` de la
-- guarda pasa a excluir también admin_plus.
create or replace function public.bodega_procesar_pedido(
  p_pedido_id uuid,
  p_items jsonb,
  p_estado text,
  p_fecha_estimada date default null
)
returns public.pedidos
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario public.usuarios%rowtype;
  v_pedido  public.pedidos%rowtype;
  v_item    jsonb;
begin
  select * into v_usuario from public.usuarios where auth_user_id = auth.uid();
  if v_usuario.id is null then
    raise exception 'Tu sesión expiró. Vuelve a entrar.';
  end if;
  if v_usuario.role not in ('admin', 'admin_plus') and not coalesce(v_usuario.puede_gestionar_bodega, false) then
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
$function$;
