import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

// reconocimientos tiene 2 FKs a usuarios (empleado_id, otorgado_por) — hay que
// especificar cuál usar en el embed, si no PostgREST tira PGRST201 (ambiguo).
const SELECT_CON_EMPLEADO = "*, usuarios!empleado_id(name, sucursal, puesto)";

const mapReconocimiento = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  empleado: row.usuarios?.name,
  sucursal: row.usuarios?.sucursal,
  puesto: row.usuarios?.puesto,
  categoria: row.categoria,
  comentario: row.comentario,
  otorgadoPorId: row.otorgado_por,
  otorgadoPor: row.otorgado_por_nombre,
  fecha: row.fecha,
});

export const getReconocimientos = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("reconocimientos").select(SELECT_CON_EMPLEADO));
    return rows.map(mapReconocimiento);
  } catch (error) {
    console.error("Error al obtener reconocimientos:", error);
    throw new Error("No se pudieron cargar los reconocimientos.", { cause: error });
  }
};

export const addReconocimiento = async ({ empleadoId, categoria, comentario, otorgadoPorId, otorgadoPor }) => {
  const { data, error } = await supabase
    .from("reconocimientos")
    .insert({
      empleado_id: empleadoId,
      categoria,
      comentario,
      otorgado_por: otorgadoPorId,
      otorgado_por_nombre: otorgadoPor,
    })
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error guardando reconocimiento:", error);
    throw new Error("No se pudo guardar el reconocimiento.");
  }
  return mapReconocimiento(data);
};
