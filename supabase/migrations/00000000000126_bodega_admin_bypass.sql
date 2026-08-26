-- bodega_procesar_pedido era la única de las funciones de inventario que NO dejaba pasar a
-- admin — ajustar_inventario (migración 121) sí tiene `role = 'admin' or puede_gestionar_bodega`,
-- esta se quedó solo con el flag. Mismo patrón que su hermana, nada nuevo.
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
  if v_usuario.role <> 'admin' and not coalesce(v_usuario.puede_gestionar_bodega, false) then
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
