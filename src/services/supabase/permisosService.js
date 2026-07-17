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

export const addPermiso = async ({ empleadoId, fecha, fechaFin, hora, causa, motivo, comentario, origen, estado }) => {
  const { data, error } = await supabase
    .from("permisos")
    .insert({
      empleado_id: empleadoId,
      fecha,
      // null explícito, no undefined: un permiso de un día no tiene fecha de fin, y
      // mandar undefined haría que PostgREST omitiera la columna en vez de anularla.
      fecha_fin: fechaFin || null,
      // Igual que fecha_fin: un permiso sin hora manda null, no "". Postgres rechaza la cadena
      // vacía para el tipo `time` ("invalid input syntax for type time"), y tumbaba la solicitud.
      hora: hora || null,
      causa: causa || null,
      motivo,
      comentario,
      origen: origen || "empleado",
      // Sin estado: la base lo deja en 'pendiente' (default). Gestión lo usa para
      // justificar una falta ya aprobada de una — no tiene sentido pedirle a RH que
      // apruebe su propia corrección.
      ...(estado ? { estado } : {}),
    })
    .select(SELECT_CON_EMPLEADO)
    .single();

  if (error) {
    console.error("Error solicitando permiso:", error);
    throw new Error("No se pudo registrar la solicitud de permiso.");
  }
  return mapPermiso(data);
};

/**
 * Aprobar/rechazar pasa por el SERVIDOR (api/aprobar-permiso.js), no por un update directo.
 *
 * El motivo es el push: avisar al empleado exige la clave privada de VAPID, que vive solo en el
 * servidor. La actualización de la fila y el envío del aviso ocurren juntos, del lado seguro.
 */
export const updateEstadoPermiso = async (id, estado, comentarioRH = "") => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/aprobar-permiso", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ permisoId: id, estado, comentarioRh: comentarioRH }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("Error actualizando permiso:", cuerpo.error);
    throw new Error(cuerpo.error || "No se pudo actualizar el estado del permiso.");
  }
  return mapPermiso(cuerpo.permiso);
};
