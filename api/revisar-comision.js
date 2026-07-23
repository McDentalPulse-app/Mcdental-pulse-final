import { configOk, admin, quienLlama } from "./_auth.js";
import { notificar } from "./_notificaciones.js";

/**
 * RH revisa una comisión (recibo) de un doctor y la marca 'valida' o 'invalida'. Calcado de
 * api/aprobar-vacacion.js: pasa por el servidor porque, además de actualizar el estado, le
 * MANDA UN MENSAJE al doctor con el veredicto y le dispara la notificación/push — y la clave
 * privada de VAPID solo vive aquí. El mensaje y el push son extras: si fallan, la comisión queda
 * resuelta igual.
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
    return res.status(403).json({ error: "Solo Recursos Humanos puede revisar una comisión." });
  }

  const { comisionId, estado, comentario } = req.body || {};
  if (!comisionId || !["valida", "invalida"].includes(estado)) {
    return res.status(400).json({ error: "Faltan datos o el estado no es válido." });
  }

  const supabase = admin();

  const { data: comision, error } = await supabase
    .from("comisiones")
    .update({
      estado,
      comentario_rh: comentario || "",
      revisado_por: quien.id,
      revisado_en: new Date().toISOString(),
    })
    .eq("id", comisionId)
    .select("*, usuarios:doctor_id(name)")
    .single();

  if (error) {
    console.error("Error revisando la comisión:", error);
    return res.status(500).json({ error: "No se pudo actualizar la comisión." });
  }

  const fechaTxt = new Date(`${comision.fecha}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  });
  const valida = estado === "valida";
  const cuerpo = valida
    ? `Tu recibo del ${fechaTxt} fue validado.${comision.comentario_rh ? ` ${comision.comentario_rh}` : ""}`
    : `Tu recibo del ${fechaTxt} fue rechazado.${comision.comentario_rh ? ` ${comision.comentario_rh}` : ""}`;

  // Mensaje de RH → doctor con el veredicto (el usuario pidió explícitamente "rh le manda un
  // mensaje si es válido o no"). Va por la tabla de mensajes: aparece en la bandeja del doctor.
  await supabase
    .from("mensajes")
    .insert({ de_id: quien.id, para_id: comision.doctor_id, texto: cuerpo })
    .then(({ error: e }) => { if (e) console.error("Error guardando mensaje de comisión:", e); });

  // Notificación persistente + push.
  await notificar(comision.doctor_id, {
    tipo: "comision",
    titulo: valida ? "Comisión validada" : "Comisión rechazada",
    cuerpo,
    url: "/doctor/comisiones",
  }).catch(() => {});

  return res.status(200).json({ ok: true, comision });
}
