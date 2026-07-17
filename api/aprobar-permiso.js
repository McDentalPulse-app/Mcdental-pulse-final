import { configOk, admin, quienLlama } from "./_auth.js";
import { notificar } from "./_notificaciones.js";

/**
 * RH aprueba o rechaza un permiso.
 *
 * POR QUÉ ESTO PASA POR EL SERVIDOR, cuando antes era un update directo desde el navegador:
 *
 * Para MANDAR EL AVISO al empleado. El push se firma con la clave privada de VAPID, que no puede
 * salir del servidor — así que la aprobación tiene que ocurrir donde vive esa clave. De paso,
 * centraliza la validación (quién puede aprobar) en un sitio y no en la confianza de que el
 * cliente respete las reglas.
 *
 * El aviso es un EXTRA: si el push falla, el permiso queda aprobado igual (enviar() nunca lanza).
 * Enterarse de una aprobación es bueno, pero la aprobación no depende de que el teléfono la reciba.
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
    return res.status(403).json({ error: "Solo Recursos Humanos puede resolver un permiso." });
  }

  const { permisoId, estado, comentarioRh } = req.body || {};
  if (!permisoId || !["aprobado", "rechazado"].includes(estado)) {
    return res.status(400).json({ error: "Faltan datos o el estado no es válido." });
  }

  const supabase = admin();

  const { data: permiso, error } = await supabase
    .from("permisos")
    .update({ estado, comentario_rh: comentarioRh || "" })
    .eq("id", permisoId)
    .select("*, usuarios(name, sucursal, puesto)")
    .single();

  if (error) {
    console.error("Error resolviendo el permiso:", error);
    return res.status(500).json({ error: "No se pudo actualizar el permiso." });
  }

  // El aviso, en segundo plano. No se hace await bloqueante del resultado: la respuesta a RH no
  // tiene por qué esperar a que Apple/Google confirmen la entrega.
  const fecha = new Date(`${permiso.fecha}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  });
  notificar(permiso.empleado_id, {
    tipo: "permiso",
    titulo: estado === "aprobado" ? "Permiso aprobado" : "Permiso rechazado",
    cuerpo:
      estado === "aprobado"
        ? `Tu permiso del ${fecha} fue aprobado.`
        : `Tu permiso del ${fecha} no fue aprobado.${permiso.comentario_rh ? ` ${permiso.comentario_rh}` : ""}`,
    url: "/empleado/permisosempleado",
  }).catch(() => {});

  return res.status(200).json({ ok: true, permiso });
}
