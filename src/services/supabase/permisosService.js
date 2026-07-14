import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const SELECT_CON_EMPLEADO = "*, usuarios(name, sucursal, puesto)";

const mapPermiso = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  empleado: row.usuarios?.name,
  sucursal: row.usuarios?.sucursal,
  puesto: row.usuarios?.puesto,
  fecha: row.fecha,
  fechaFin: row.fecha_fin, // null = permiso de un solo día (migración 038)
  hora: row.hora,
  causa: row.causa,
  motivo: row.motivo,
  comentario: row.comentario,
  comentarioRH: row.comentario_rh,
  estado: row.estado,
  origen: row.origen,
  createdAt: row.created_at,
});

export const getPermisos = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("permisos").select(SELECT_CON_EMPLEADO));
    return rows.map(mapPermiso);
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    throw new Error("No se pudieron cargar los permisos.", { cause: error });
  }
};

export const addPermiso = async ({ empleadoId, fecha, fechaFin, hora, causa, motivo, comentario, origen }) => {
  const { data, error } = await supabase
    .from("permisos")
    .insert({
      empleado_id: empleadoId,
      fecha,
      // null explícito, no undefined: un permiso de un día no tiene fecha de fin, y
      // mandar undefined haría que PostgREST omitiera la columna en vez de anularla.
      fecha_fin: fechaFin || null,
      hora,
      causa: causa || null,
      motivo,
      comentario,
      origen: origen || "empleado",
    })
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error solicitando permiso:", error);
    throw new Error("No se pudo registrar la solicitud de permiso.");
  }
  return mapPermiso(data);
};

export const updateEstadoPermiso = async (id, estado, comentarioRH = "") => {
  const { data, error } = await supabase
    .from("permisos")
    .update({ estado, comentario_rh: comentarioRH })
    .eq("id", id)
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error actualizando permiso:", error);
    throw new Error("No se pudo actualizar el estado del permiso.");
  }
  return mapPermiso(data);
};
