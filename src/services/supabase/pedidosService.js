import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const SELECT_COMPLETO =
  "*, usuarios!pedidos_solicitado_por_fkey(name), sucursales(nombre), pedido_items(*, materiales(nombre, unidad_medida))";

const mapPedido = (row) => ({
  id: row.id,
  sucursalId: row.sucursal_id,
  sucursal: row.sucursales?.nombre,
  solicitadoPor: row.solicitado_por,
  solicitante: row.usuarios?.name,
  origen: row.origen, // 'recepcion' | 'admin' — así bodega ve "pedido directo del admin"
  estado: row.estado,
  fechaEstimadaEntrega: row.fecha_estimada_entrega,
  comentario: row.comentario,
  createdAt: row.created_at,
  items: (row.pedido_items || []).map((it) => ({
    id: it.id,
    materialId: it.material_id,
    material: it.materiales?.nombre,
    unidadMedida: it.materiales?.unidad_medida,
    cantidadSolicitada: Number(it.cantidad_solicitada),
    cantidadEnviada: it.cantidad_enviada === null ? null : Number(it.cantidad_enviada),
  })),
});

/** RLS ya filtra: admin y bodega ven todo, recepción solo lo de su sucursal. */
export const getPedidos = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("pedidos").select(SELECT_COMPLETO).order("created_at", { ascending: false }),
    );
    return rows.map(mapPedido);
  } catch (error) {
    console.error("Error al obtener pedidos:", error);
    throw new Error("No se pudieron cargar los pedidos.", { cause: error });
  }
};

/**
 * Crea un pedido con sus líneas en una sola transacción (RPC crear_pedido, migración 122).
 * `sucursalId` solo importa para admin (pedido especial a una clínica elegida); a recepción
 * la RPC la ignora y resuelve su propia sucursal — no hay forma de pedir a nombre de otra.
 */
export const addPedido = async ({ sucursalId, items, comentario }) => {
  if (!items?.length) throw new Error("El pedido necesita al menos un material.");

  const { data, error } = await supabase.rpc("crear_pedido", {
    p_sucursal_id: sucursalId ?? null,
    p_items: items.map((it) => ({ materialId: it.materialId, cantidad: it.cantidad })),
    p_comentario: comentario || null,
  });

  if (error) {
    console.error("Error creando pedido:", error);
    throw new Error(error.message || "No se pudo crear el pedido.");
  }
  return mapPedido(Array.isArray(data) ? data[0] : data);
};

/**
 * Bodega decide y procesa (RPC bodega_procesar_pedido, migración 122): cuánto envía por
 * línea, en qué estado queda el pedido. Si `estado` es 'enviado', ahí mismo sube el
 * inventario de la clínica — no hay paso de confirmación aparte (decisión ya tomada).
 */
export const procesarPedidoBodega = async ({ pedidoId, items, estado, fechaEstimada }) => {
  const { data, error } = await supabase.rpc("bodega_procesar_pedido", {
    p_pedido_id: pedidoId,
    p_items: (items || []).map((it) => ({
      pedidoItemId: it.pedidoItemId,
      cantidadEnviada: it.cantidadEnviada,
    })),
    p_estado: estado,
    p_fecha_estimada: fechaEstimada || null,
  });

  if (error) {
    console.error("Error procesando pedido:", error);
    throw new Error(error.message || "No se pudo procesar el pedido.");
  }
  return mapPedido(Array.isArray(data) ? data[0] : data);
};

/** Bitácora de un pedido: cuándo cambió de estado y quién lo hizo (pedido_estado_log). */
export const getEstadoLogPedido = async (pedidoId) => {
  const { data, error } = await supabase
    .from("pedido_estado_log")
    .select("*, usuarios(name)")
    .eq("pedido_id", pedidoId)
    .order("cambiado_en", { ascending: true });

  if (error) {
    console.error("Error al obtener la bitácora del pedido:", error);
    throw new Error("No se pudo cargar la bitácora del pedido.", { cause: error });
  }
  return data.map((row) => ({
    estadoAnterior: row.estado_anterior,
    estadoNuevo: row.estado_nuevo,
    cambiadoPor: row.usuarios?.name,
    cambiadoEn: row.cambiado_en,
  }));
};
