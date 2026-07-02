import { supabase } from "../../config/supabase";

const SELECT_CON_EMPLEADO = "*, usuarios(name, sucursal, puesto)";

const mapPermiso = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  empleado: row.usuarios?.name,
  sucursal: row.usuarios?.sucursal,
  puesto: row.usuarios?.puesto,
  fecha: row.fecha,
  hora: row.hora,
  motivo: row.motivo,
  comentario: row.comentario,
  comentarioRH: row.comentario_rh,
  estado: row.estado,
  origen: row.origen,
  createdAt: row.created_at,
});

export const getPermisos = async () => {
  const { data, error } = await supabase.from("permisos").select(SELECT_CON_EMPLEADO);
  if (error) {
    console.error("Error al obtener permisos:", error);
    throw new Error("No se pudieron cargar los permisos.");
  }
  return data.map(mapPermiso);
};

export const addPermiso = async ({ empleadoId, fecha, hora, motivo, comentario, origen }) => {
  const { data, error } = await supabase
    .from("permisos")
    .insert({
      empleado_id: empleadoId,
      fecha,
      hora,
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
