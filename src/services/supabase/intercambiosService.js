import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const SELECT_CON_EMPLEADO = "*, usuarios:empleado_id(name, sucursal, puesto)";

const mapIntercambio = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  empleado: row.usuarios?.name,
  sucursal: row.usuarios?.sucursal,
  puesto: row.usuarios?.puesto,
  fechaFestivo: row.fecha_festivo,
  fechaDestino: row.fecha_destino,
  estado: row.estado,
  comentarioRH: row.comentario_rh,
  createdAt: row.created_at,
});

// RLS filtra: el empleado/doctor recibe solo los suyos; gestión, todos.
export const getIntercambios = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("intercambios_dia").select(SELECT_CON_EMPLEADO).order("created_at", { ascending: false }),
    );
    return rows.map(mapIntercambio);
  } catch (error) {
    console.error("Error al obtener intercambios:", error);
    throw new Error("No se pudieron cargar los intercambios.", { cause: error });
  }
};

// Fechas destino ya ocupadas (sin revelar quién): una RPC security definer las expone para que
// el calendario pueda deshabilitar los días tomados. Ver migración 075.
export const getDestinosOcupados = async () => {
  const { data, error } = await supabase.rpc("intercambios_destinos_ocupados");
  if (error) {
    console.error("Error obteniendo destinos ocupados:", error);
    return [];
  }
  return (data || []).map((d) => (typeof d === "string" ? d : d.fecha_destino));
};

/**
 * Solicita un intercambio. Pasa por el SERVIDOR (api/solicitar-intercambio.js): avisa a RH por
 * push y devuelve 409 si el día destino ya está apartado (índice único).
 */
export const solicitarIntercambio = async ({ fechaFestivo, fechaDestino }) => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/solicitar-intercambio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fechaFestivo, fechaDestino }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(cuerpo.error || "No se pudo registrar tu solicitud.");
  }
  return mapIntercambio(cuerpo.intercambio);
};

/** RH aprueba/rechaza. Pasa por el SERVIDOR (api/resolver-intercambio.js) para avisar al doctor. */
export const resolverIntercambio = async (id, estado, comentario = "") => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/resolver-intercambio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ intercambioId: id, estado, comentario }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(cuerpo.error || "No se pudo actualizar la solicitud.");
  }
  return mapIntercambio(cuerpo.intercambio);
};
