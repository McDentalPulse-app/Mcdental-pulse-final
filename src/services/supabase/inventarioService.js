import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const SELECT_CON_MATERIAL = "*, materiales(nombre, unidad_medida, umbral_stock_bajo, activo)";

const mapInventario = (row) => ({
  sucursalId: row.sucursal_id,
  materialId: row.material_id,
  material: row.materiales?.nombre,
  unidadMedida: row.materiales?.unidad_medida,
  umbralStockBajo: Number(row.materiales?.umbral_stock_bajo ?? 0),
  cantidadActual: Number(row.cantidad_actual),
  updatedAt: row.updated_at,
});

/**
 * Inventario de UNA clínica (recepción con puede_gestionar_inventario, o admin/bodega
 * filtrando por sucursal). RLS decide qué filas llegan de verdad.
 */
export const getInventarioSucursal = async (sucursalId) => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("inventario_sucursal").select(SELECT_CON_MATERIAL).eq("sucursal_id", sucursalId),
    );
    return rows.map(mapInventario);
  } catch (error) {
    console.error("Error al obtener el inventario de la sucursal:", error);
    throw new Error("No se pudo cargar el inventario.", { cause: error });
  }
};

/** Inventario de TODAS las clínicas (admin/bodega). */
export const getInventarioTodasSucursales = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("inventario_sucursal").select(SELECT_CON_MATERIAL));
    return rows.map(mapInventario);
  } catch (error) {
    console.error("Error al obtener el inventario de las sucursales:", error);
    throw new Error("No se pudo cargar el inventario.", { cause: error });
  }
};

/**
 * Registra consumo de material en la clínica de quien lo registra. La cantidad se manda
 * NEGATIVA (resta) — la RLS de inventario_movimientos exige exactamente eso; ver migración 121.
 * `registradoPor` es el `id` del usuario en sesión (lo trae el componente, igual que
 * `empleadoId` en permisosService.addPermiso).
 */
export const registrarConsumo = async ({ sucursalId, materialId, cantidad, nota, registradoPor }) => {
  if (!cantidad || cantidad <= 0) throw new Error("La cantidad debe ser mayor a cero.");

  const { error } = await supabase.from("inventario_movimientos").insert({
    sucursal_id: sucursalId,
    material_id: materialId,
    tipo: "consumo",
    cantidad: -Math.abs(cantidad),
    registrado_por: registradoPor,
    nota: nota || null,
  });

  if (error) {
    console.error("Error registrando consumo:", error);
    throw new Error("No se pudo registrar el consumo.");
  }
};

/**
 * Ajusta el stock de un material en una clínica, suma o resta según el signo de `cantidad`.
 * Va por RPC (no INSERT directo): 'ajuste' no está en la policy de INSERT de
 * inventario_movimientos (migración 121), solo la función `ajustar_inventario` (migración 123)
 * puede escribirlo. Quien tiene puede_gestionar_inventario ajusta su propia clínica sin
 * importar qué `sucursalId` se mande — la RPC lo resuelve de la sesión, igual que un pedido.
 */
export const ajustarInventario = async ({ sucursalId, materialId, cantidad, nota }) => {
  if (!cantidad || Number(cantidad) === 0) throw new Error("La cantidad del ajuste no puede ser cero.");

  const { data, error } = await supabase.rpc("ajustar_inventario", {
    p_sucursal_id: sucursalId,
    p_material_id: materialId,
    p_cantidad: Number(cantidad),
    p_nota: nota || null,
  });

  if (error) {
    console.error("Error ajustando inventario:", error);
    throw new Error(error.message || "No se pudo ajustar el inventario.");
  }
  return data;
};

/** Bitácora: movimientos de una clínica (o de todas si se omite sucursalId), más recientes primero. */
export const getMovimientosInventario = async (sucursalId) => {
  try {
    const rows = await fetchAll(() => {
      let query = supabase
        .from("inventario_movimientos")
        .select("*, materiales(nombre), sucursales(nombre), usuarios(name)")
        .order("creada_en", { ascending: false });
      return sucursalId ? query.eq("sucursal_id", sucursalId) : query;
    });
    return rows.map((row) => ({
      id: row.id,
      sucursalId: row.sucursal_id,
      sucursal: row.sucursales?.nombre,
      materialId: row.material_id,
      material: row.materiales?.nombre,
      tipo: row.tipo,
      cantidad: Number(row.cantidad),
      pedidoId: row.pedido_id,
      registradoPor: row.usuarios?.name,
      nota: row.nota,
      creadaEn: row.creada_en,
    }));
  } catch (error) {
    console.error("Error al obtener los movimientos de inventario:", error);
    throw new Error("No se pudo cargar la bitácora de inventario.", { cause: error });
  }
};
