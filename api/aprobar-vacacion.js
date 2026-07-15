import { configOk, admin, quienLlama } from "./_auth.js";
import { enviar } from "./_push.js";

/**
 * RH aprueba o rechaza una solicitud de vacaciones. Calcado de api/aprobar-permiso.js: pasa por
 * el servidor para poder avisar por push al empleado, con la clave privada de VAPID que solo
 * vive aquí. El aviso es un extra — si el push falla, la solicitud queda resuelta igual.
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
  if (!["admin", "rh"].includes(quien.role)) {
    return res.status(403).json({ error: "Solo Recursos Humanos puede resolver una solicitud de vacaciones." });
  }

  const { vacacionId, estado, comentarioRH } = req.body || {};
  if (!vacacionId || !["aprobado", "rechazado"].includes(estado)) {
    return res.status(400).json({ error: "Faltan datos o el estado no es válido." });
  }

  const supabase = admin();

  const { data: vacacion, error } = await supabase
    .from("vacaciones")
    .update({ estado, comentario_rh: comentarioRH || "" })
    .eq("id", vacacionId)
    .select("*, usuarios(name, sucursal, puesto)")
    .single();

  if (error) {
    console.error("Error resolviendo la solicitud de vacaciones:", error);
    return res.status(500).json({ error: "No se pudo actualizar la solicitud de vacaciones." });
  }

  const inicio = new Date(`${vacacion.fecha_inicio}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  });
  const fin = new Date(`${vacacion.fecha_fin}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  });

  enviar(vacacion.empleado_id, {
    titulo: estado === "aprobado" ? "Vacaciones aprobadas" : "Vacaciones rechazadas",
    cuerpo:
      estado === "aprobado"
        ? `Tus vacaciones del ${inicio} al ${fin} fueron aprobadas.`
        : `Tus vacaciones del ${inicio} al ${fin} no fueron aprobadas.${vacacion.comentario_rh ? ` ${vacacion.comentario_rh}` : ""}`,
    url: "/empleado/permisosempleado",
  }).catch(() => {});

  return res.status(200).json({ ok: true, vacacion });
}
