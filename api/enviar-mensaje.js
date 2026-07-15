import { configOk, admin, quienLlama } from "./_auth.js";
import { enviar } from "./_push.js";

/**
 * Envía un mensaje del canal confidencial empleado ↔ psicóloga y avisa por push a quien lo
 * recibe.
 *
 * POR QUÉ ESTO PASA POR EL SERVIDOR, cuando antes era un insert directo desde el navegador: para
 * mandar el aviso. El push se firma con la clave privada de VAPID, que no puede salir del
 * servidor, así que el envío del mensaje tiene que ocurrir donde vive esa clave. De paso, el
 * remitente (`de_id`) sale de la sesión verificada, nunca de lo que mande el cliente.
 *
 * El aviso es un EXTRA: si el push falla, el mensaje queda guardado igual (enviar() nunca lanza).
 */
const RUTA_POR_ROL = {
  empleado: "/empleado/mensajes",
  psicologa: "/psicologa/mensajes",
};

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

  const { paraId, texto, fecha } = req.body || {};
  if (!paraId || !texto || !String(texto).trim()) {
    return res.status(400).json({ error: "Falta el destinatario o el texto del mensaje." });
  }

  const supabase = admin();

  const payload = { de_id: quien.id, para_id: paraId, texto: String(texto).trim() };
  if (fecha) payload.fecha = fecha;

  const { data: destinatario } = await supabase
    .from("usuarios")
    .select("id, role")
    .eq("id", paraId)
    .single();

  const { data: mensaje, error } = await supabase
    .from("mensajes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error guardando mensaje:", error);
    return res.status(500).json({ error: "No se pudo enviar el mensaje." });
  }

  enviar(paraId, {
    titulo: `Nuevo mensaje de ${quien.name}`,
    cuerpo: mensaje.texto.slice(0, 120),
    url: RUTA_POR_ROL[destinatario?.role] || "/",
  }).catch(() => {});

  return res.status(200).json({ ok: true, mensaje });
}
