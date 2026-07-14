import { configOk, admin, quienLlama } from "./_auth.js";

/**
 * Aprueba o rechaza el rostro que un empleado registró por su cuenta.
 *
 * ESTE ENDPOINT ES EL COTEJO ENTERO. Todo lo demás —los modelos, las huellas, los
 * umbrales— depende de que aquí alguien haya mirado las fotos y haya afirmado: "esta cara
 * es la de esta persona".
 *
 * Si se aprueba sin mirar, el compañero que le robó la contraseña a Juan registra SU
 * PROPIA cara en la cuenta de Juan, se aprueba de un clic, y a partir de ese momento checa
 * por él con un 99% de parecido — verificado y bendecido por el sistema. El cotejo dejaría
 * de detectar el fraude: pasaría a certificarlo.
 *
 * Por eso queda registrado QUIÉN aprobó y CUÁNDO. Aprobar es afirmar una identidad, y eso
 * tiene un responsable con nombre.
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
    return res.status(403).json({ error: "Solo Recursos Humanos puede aprobar un rostro." });
  }

  const { empleadoId, aprobar, motivo } = req.body || {};
  if (!empleadoId || typeof aprobar !== "boolean") {
    return res.status(400).json({ error: "Faltan datos." });
  }

  const supabase = admin();

  const { error } = await supabase
    .from("rostros")
    .update({
      estado: aprobar ? "aprobado" : "rechazado",
      revisado_por: quien.id,
      revisado_en: new Date().toISOString(),
      motivo_rechazo: aprobar ? null : (motivo || "Las fotos no sirven o no corresponden."),
    })
    .eq("empleado_id", empleadoId)
    .eq("estado", "pendiente"); // solo se revisa lo pendiente: no se re-aprueba a la ligera

  if (error) {
    console.error("Error revisando el rostro:", error);
    return res.status(500).json({ error: "No se pudo guardar la revisión." });
  }

  return res.status(200).json({ ok: true });
}
