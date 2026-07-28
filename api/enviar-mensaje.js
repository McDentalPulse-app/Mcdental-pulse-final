import { configOk, admin, quienLlama } from "./_auth.js";
import { notificar } from "./_notificaciones.js";
import { primerEnlace, vistaPreviaEnlace } from "./_enlace.js";

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
  // Mismo olvido que la guarda de abajo: sin esta entrada, al pulsar el aviso un doctor
  // aterrizaba en "/" en vez de en su conversación.
  doctor: "/doctor/mensajes",
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

  const { paraId, texto, fecha, adjunto, respondeA } = req.body || {};
  const hayTexto = texto && String(texto).trim();
  // Desde la migración 086 un mensaje puede ser solo una foto o un documento: lo que no se
  // admite es un mensaje sin nada, y eso lo vigila también el CHECK de la tabla.
  if (!paraId || (!hayTexto && !adjunto?.path)) {
    return res.status(400).json({ error: "Falta el destinatario o el contenido del mensaje." });
  }

  const supabase = admin();

  const { data: destinatario } = await supabase
    .from("usuarios")
    .select("id, role")
    .eq("id", paraId)
    .single();

  if (!destinatario) {
    return res.status(400).json({ error: "Destinatario no encontrado." });
  }

  // Un empleado solo puede escribir a alguien de gestión (admin/rh/psicóloga), nunca a otro
  // empleado: este es el canal confidencial empleado↔psicóloga, no un chat entre compañeros.
  //
  // 'doctor' entra aquí desde 2026-07-27: el rol se creó en la migración 072 y esta guarda se
  // quedó mirando solo a 'empleado', así que un doctor podía escribirle a cualquiera. Un doctor
  // es un empleado con extras, y en este canal vale la misma regla.
  const esGestion = (role) => ["admin", "rh", "psicologa"].includes(role);
  if (["empleado", "doctor"].includes(quien.role) && !esGestion(destinatario.role)) {
    return res.status(403).json({ error: "No puedes enviar mensajes a otro empleado por este canal." });
  }

  const payload = { de_id: quien.id, para_id: paraId };
  if (hayTexto) payload.texto = String(texto).trim().slice(0, 2000);
  if (fecha) payload.fecha = fecha;

  if (respondeA) {
    // Se comprueba que el mensaje citado exista Y sea de esta misma conversación: si no, se
    // podría citar un mensaje ajeno y hacer que su texto apareciera —dentro de la cita— ante
    // alguien que nunca tuvo derecho a leerlo.
    const { data: citado } = await supabase
      .from("mensajes")
      .select("id, de_id, para_id")
      .eq("id", respondeA)
      .single();
    const dosPartes = [quien.id, paraId];
    if (!citado || !dosPartes.includes(citado.de_id) || !dosPartes.includes(citado.para_id)) {
      return res.status(400).json({ error: "No puedes responder a ese mensaje." });
    }
    payload.responde_a = respondeA;
  }

  if (adjunto?.path) {
    // La ruta tiene que empezar por la carpeta de quien envía. La política del bucket ya lo
    // exige al SUBIR, pero sin esta comprobación alguien podría insertar un mensaje que
    // apunte al archivo de otra conversación y, de paso, concederse permiso para leerlo:
    // `mensajes_obj_select_participante` da acceso a lo que va dirigido a uno.
    if (String(adjunto.path).split("/")[0] !== quien.id) {
      return res.status(403).json({ error: "El adjunto no te pertenece." });
    }
    payload.adjunto_path = String(adjunto.path).slice(0, 500);
    payload.adjunto_nombre = String(adjunto.nombre || "archivo").slice(0, 255);
    payload.adjunto_mime = String(adjunto.mime || "application/octet-stream").slice(0, 128);
    payload.adjunto_bytes = Number(adjunto.bytes) || null;
    payload.adjunto_meta = adjunto.meta && typeof adjunto.meta === "object" ? adjunto.meta : null;
  }

  // Vista previa del primer enlace, ANTES de insertar: el trigger de la migración 088 no deja
  // tocar la fila después, y es lo correcto — la tarjeta refleja lo que había cuando se mandó
  // el mensaje, no lo que el sitio diga mañana.
  //
  // Cuesta hasta 3 segundos (el tope de _enlace.js) y solo cuando el mensaje trae un enlace.
  // Si falla, `vistaPreviaEnlace` devuelve null y el mensaje sale igual: nunca lanza.
  if (hayTexto) {
    const url = primerEnlace(texto);
    if (url) {
      const previa = await vistaPreviaEnlace(url);
      if (previa) payload.enlace = previa;
    }
  }

  const { data: mensaje, error } = await supabase
    .from("mensajes")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("Error guardando mensaje:", error);
    return res.status(500).json({ error: "No se pudo enviar el mensaje." });
  }

  // `texto` ya puede venir vacío (mensaje que es solo un adjunto), así que el cuerpo del aviso
  // no se puede dar por hecho: sin esto, un .slice() sobre null tumbaría el envío del push.
  const resumen = mensaje.texto
    ? mensaje.texto.slice(0, 120)
    : (mensaje.adjunto_mime || "").startsWith("image/")
      ? "Te envió una imagen"
      : "Te envió un archivo";

  await notificar(paraId, {
    tipo: "mensaje",
    titulo: `Nuevo mensaje de ${quien.name}`,
    cuerpo: resumen,
    url: RUTA_POR_ROL[destinatario?.role] || "/",
  }).catch(() => {});

  return res.status(200).json({ ok: true, mensaje });
}
