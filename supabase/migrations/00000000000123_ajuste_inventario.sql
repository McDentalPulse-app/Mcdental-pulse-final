-- Ajuste manual de stock (plan: inventario-clinicas, ronda 2).
--
-- La tabla `inventario_movimientos` ya tenía el tipo 'ajuste' desde la migración 121, pero sin
-- RPC no había forma de insertarlo: la policy de INSERT solo deja 'consumo' directo desde el
-- cliente (migración 121). Esto lo cablea, para cargar o corregir stock rápido sin pasar por
-- el circuito completo de pedido → bodega procesa → sube inventario.
--
-- Permiso (decisión del dueño): admin y bodega ajustan CUALQUIER clínica; quien tiene
-- puede_gestionar_inventario ajusta SOLO la suya — mismo patrón de "se resuelve de la propia
-- cuenta, no se recibe nombrable" que ya usan crear_pedido (migración 122) y
-- fijar_geocerca_mi_sucursal (migración 103).

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

  if v_usuario.role = 'admin' or coalesce(v_usuario.puede_gestionar_bodega, false) then
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

grant execute on function public.ajustar_inventario(uuid, uuid, numeric, text) to authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (local):
--   (como bodega) select ajustar_inventario(<sucursal>, <material>, 50, 'carga inicial');
--     -> inventario_sucursal de esa clínica sube 50, aparece en la bitácora tipo 'ajuste'.
--   (como recepción con puede_gestionar_inventario, sin pasar sucursal ajena) select
--     ajustar_inventario(<su_propia_sucursal>, <material>, -5, null);
--     -> resta 5 de SU clínica. Si pasa el id de otra clínica, igual ajusta la suya (se
--        resuelve del usuario, el parámetro para esa rama se ignora).
--   select ajustar_inventario(<sucursal>, <material>, -999999, null);
--     -> 'Ese ajuste dejaría el stock en negativo...', no inserta nada.
--   (como empleado sin ninguno de los tres permisos) -> 'No tienes permiso para ajustar inventario.'
--
-- ROLLBACK:
--   drop function if exists public.ajustar_inventario(uuid, uuid, numeric, text);
-- ----------------------------------------------------------------------------
