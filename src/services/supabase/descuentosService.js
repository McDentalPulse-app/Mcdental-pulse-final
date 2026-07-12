import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

// descuentos tiene 2 FKs a usuarios (empleado_id, responsable_id) — hay que
// especificar cuál usar en el embed, si no PostgREST tira PGRST201 (ambiguo).
const SELECT_CON_EMPLEADO = "*, usuarios!empleado_id(name, sucursal, puesto)";

const mapDescuento = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  empleado: row.usuarios?.name,
  sucursal: row.usuarios?.sucursal,
  puesto: row.usuarios?.puesto,
  tipo: row.tipo,
  motivo: row.motivo,
  observaciones: row.observaciones,
  monto: row.monto,
  fecha: row.fecha,
  estado: row.estado,
  responsableId: row.responsable_id,
  responsable: row.responsable_nombre,
  createdAt: row.created_at,
});

export const getDescuentos = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("descuentos").select(SELECT_CON_EMPLEADO));
    return rows.map(mapDescuento);
  } catch (error) {
    console.error("Error al obtener descuentos:", error);
    throw new Error("No se pudieron cargar los descuentos.", { cause: error });
  }
};

export const addDescuento = async ({ empleadoId, tipo, motivo, observaciones, monto, fecha, responsableId, responsable }) => {
  const { data, error } = await supabase
    .from("descuentos")
    .insert({
      empleado_id: empleadoId,
      tipo,
      motivo,
      observaciones,
      monto,
      fecha,
      responsable_id: responsableId,
      responsable_nombre: responsable,
    })
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error registrando descuento:", error);
    throw new Error("No se pudo registrar el descuento.");
  }
  return mapDescuento(data);
};

export const updateDescuentoEstado = async (id, estado) => {
  const { data, error } = await supabase
    .from("descuentos")
    .update({ estado })
    .eq("id", id)
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error actualizando descuento:", error);
    throw new Error("No se pudo actualizar el descuento.");
  }
  return mapDescuento(data);
};
