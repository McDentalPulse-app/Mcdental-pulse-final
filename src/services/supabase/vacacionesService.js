import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const SELECT_CON_EMPLEADO = "*, usuarios(name, sucursal, puesto)";

const mapVacacion = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  empleado: row.usuarios?.name,
  sucursal: row.usuarios?.sucursal,
  puesto: row.usuarios?.puesto,
  fechaInicio: row.fecha_inicio,
  fechaFin: row.fecha_fin,
  dias: row.dias,
  motivo: row.motivo,
  comentario: row.comentario,
  comentarioRH: row.comentario_rh,
  estado: row.estado,
  origen: row.origen,
  createdAt: row.created_at,
});

export const getVacaciones = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("vacaciones").select(SELECT_CON_EMPLEADO));
    return rows.map(mapVacacion);
  } catch (error) {
    console.error("Error al obtener vacaciones:", error);
    throw new Error("No se pudieron cargar las vacaciones.", { cause: error });
  }
};

export const addVacacion = async ({ empleadoId, fechaInicio, fechaFin, dias, motivo, comentario, origen }) => {
  const { data, error } = await supabase
    .from("vacaciones")
    .insert({
      empleado_id: empleadoId,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      dias,
      motivo,
      comentario,
      origen: origen || "empleado",
    })
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error solicitando vacaciones:", error);
    throw new Error("No se pudo registrar la solicitud de vacaciones.");
  }
  return mapVacacion(data);
};

/**
 * Pasa por el SERVIDOR (api/aprobar-vacacion.js), no por un update directo: es lo que permite
 * avisar por push al empleado, con la clave privada de VAPID que solo vive ahí.
 */
export const updateEstadoVacacion = async (id, estado, comentarioRH = "") => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/resolver", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recurso: "vacacion", id, estado, comentario: comentarioRH }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("Error actualizando vacación:", cuerpo.error);
    throw new Error(cuerpo.error || "No se pudo actualizar el estado de las vacaciones.");
  }
  return mapVacacion(cuerpo.vacacion);
};
