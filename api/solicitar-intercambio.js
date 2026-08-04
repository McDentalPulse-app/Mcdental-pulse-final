import { configOk, admin, quienLlama } from "./_auth.js";
import { notificarGestion } from "./_notificaciones.js";

/**
 * Un empleado/doctor aparta un festivo para cambiarlo por otro día (fecha_destino). Pasa por el
 * servidor para avisar a gestión por push. La EXCLUSIVIDAD del destino la garantiza el índice
 * único parcial `(sucursal, fecha_destino)` de la migración 113: si dos personas DE LA MISMA
 * CLÍNICA piden la misma fecha destino, la segunda choca aquí con un 23505. Gente de clínicas
 * distintas sí puede tomar el mismo día — el límite existe para no dejar una clínica corta de
 * personal, y eso no dice nada sobre lo que haga otra clínica.
 *
 * La sucursal no se manda desde aquí: la sella un trigger desde el empleado (migración 113),
 * para que el cliente no pueda elegir en qué clínica cuenta su solicitud.
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
  if (!["empleado", "doctor"].includes(quien.role)) {
    return res.status(403).json({ error: "Solo el personal puede solicitar un intercambio de día." });
  }

  const { fechaFestivo, fechaDestino } = req.body || {};
  const fechaOk = (f) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
  if (!fechaOk(fechaFestivo) || !fechaOk(fechaDestino)) {
    return res.status(400).json({ error: "Faltan fechas o el formato no es válido." });
  }
  if (fechaFestivo === fechaDestino) {
    return res.status(400).json({ error: "El día destino no puede ser el mismo festivo." });
  }

  const supabase = admin();

  const { data: intercambio, error } = await supabase
    .from("intercambios_dia")
    .insert({ empleado_id: quien.id, fecha_festivo: fechaFestivo, fecha_destino: fechaDestino })
    .select("*")
    .single();

  if (error) {
    // 23505 = violación de índice único: alguien ya apartó ese día destino.
    if (error.code === "23505") {
      return res.status(409).json({ error: "Alguien de tu clínica ya apartó ese día. Elige otro." });
    }
    console.error("Error solicitando intercambio:", error);
    return res.status(500).json({ error: "No se pudo registrar tu solicitud." });
  }

  const destinoTxt = new Date(`${fechaDestino}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  });

  await notificarGestion({
    tipo: "intercambio",
    titulo: "Solicitud de intercambio de día",
    cuerpo: `${quien.name} pidió trabajar un festivo a cambio del ${destinoTxt}.`,
    url: { rh: "/rh/intercambios", admin: "/admin/intercambios", psicologa: "/psicologa/intercambios" },
  }).catch(() => {});

  return res.status(200).json({ ok: true, intercambio });
}
