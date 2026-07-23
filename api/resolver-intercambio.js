import { configOk, admin, quienLlama } from "./_auth.js";
import { notificar } from "./_notificaciones.js";

/**
 * RH aprueba o rechaza una solicitud de intercambio de día y avisa por push al solicitante.
 * Calcado de api/aprobar-vacacion.js. Rechazar libera la fecha destino (el índice único parcial
 * de la migración 075 solo cuenta las no-rechazadas), así que otra persona puede tomarla.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  const quien = await quienLlama(req);
  if (!quien) {
    return res.status(401).json({ error: "Sesión inválida." });
  }
  if (!["admin", "rh", "psicologa"].includes(quien.role)) {
    return res.status(403).json({ error: "Solo Recursos Humanos puede resolver un intercambio." });
  }

  const { intercambioId, estado, comentario } = req.body || {};
  if (!intercambioId || !["aprobado", "rechazado"].includes(estado)) {
    return res.status(400).json({ error: "Faltan datos o el estado no es válido." });
  }

  const supabase = admin();

  const { data: intercambio, error } = await supabase
    .from("intercambios_dia")
    .update({ estado, comentario_rh: comentario || "" })
    .eq("id", intercambioId)
    .select("*, usuarios:empleado_id(role)")
    .single();

  if (error) {
    console.error("Error resolviendo el intercambio:", error);
    return res.status(500).json({ error: "No se pudo actualizar la solicitud." });
  }

  // El destino del enlace depende del rol del solicitante (el doctor vive en /doctor).
  const rolSolicitante = intercambio.usuarios?.role === "doctor" ? "doctor" : "empleado";

  const destinoTxt = new Date(`${intercambio.fecha_destino}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  });
  const aprobado = estado === "aprobado";

  await notificar(intercambio.empleado_id, {
    tipo: "intercambio",
    titulo: aprobado ? "Intercambio de día aprobado" : "Intercambio de día rechazado",
    cuerpo: aprobado
      ? `Tu intercambio para el ${destinoTxt} fue aprobado.${intercambio.comentario_rh ? ` ${intercambio.comentario_rh}` : ""}`
      : `Tu intercambio para el ${destinoTxt} no fue aprobado.${intercambio.comentario_rh ? ` ${intercambio.comentario_rh}` : ""}`,
    url: `/${rolSolicitante}/calendario`,
  }).catch(() => {});

  return res.status(200).json({ ok: true, intercambio });
}
