import { configOk, admin, quienLlama } from "./_auth.js";
import { notificar } from "./_notificaciones.js";
import { primerEnlace, vistaPreviaEnlace } from "./_enlace.js";

/**
 * Envía un mensaje y avisa por push a quien lo recibe. Sirve a los dos canales (mig. 094): el
 * confidencial empleado ↔ psicóloga, y el buzón compartido de Soporte TI.
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

  const { paraId, texto, fecha, adjunto, respondeA, canal } = req.body || {};
  const hayTexto = texto && String(texto).trim();

  // Dos canales (mig. 094): 'psicologa' es la conversación confidencial 1 a 1 de siempre, y
  // 'soporte' es el buzón compartido de Soporte TI. Cualquier otro valor se trata como el de
  // siempre en vez de rechazarse, para que un cliente viejo —que no manda `canal`— siga enviando.
  const esSoporte = canal === "soporte";

  // En soporte, el empleado escribe SIN destinatario: el buzón no es una persona. Solo la
  // respuesta de un encargado lleva `paraId`.
  if ((!esSoporte && !paraId) || (!hayTexto && !adjunto?.path)) {
    return res.status(400).json({ error: "Falta el destinatario o el contenido del mensaje." });
  }

  const supabase = admin();

  let destinatario = null;
  if (paraId) {
    const { data } = await supabase
      .from("usuarios")
      .select("id, role")
      .eq("id", paraId)
      .single();
    destinatario = data;
    if (!destinatario) {
      return res.status(400).json({ error: "Destinatario no encontrado." });
    }
  }

  // Un empleado solo puede escribir a alguien de gestión (admin/rh/psicóloga), nunca a otro
  // empleado: este es el canal confidencial empleado↔psicóloga, no un chat entre compañeros.
  //
  // 'doctor' entra aquí desde 2026-07-27: el rol se creó en la migración 072 y esta guarda se
  // quedó mirando solo a 'empleado', así que un doctor podía escribirle a cualquiera. Un doctor
  // es un empleado con extras, y en este canal vale la misma regla.
  //
  // El canal de soporte tiene sus propias reglas (mig. 094) y por eso se comprueba aparte:
  //   - el empleado escribe al buzón, sin destinatario;
  //   - quien ATIENDE soporte contesta a una persona, y puede hacerlo aunque su rol sea
  //     `empleado` — es lo que concede la bandera `soporte_ti`, y sin esta rama la guarda de
  //     abajo se lo impediría precisamente a los dos encargados.
  const esGestion = (role) => ["admin", "rh", "psicologa"].includes(role);
  if (esSoporte) {
    if (paraId && !quien.soporte_ti) {
      return res.status(403).json({ error: "Solo quien atiende Soporte TI puede responder en ese canal." });
    }
  } else if (["empleado", "doctor"].includes(quien.role) && !esGestion(destinatario.role)) {
    return res.status(403).json({ error: "No puedes enviar mensajes a otro empleado por este canal." });
  }

  const payload = { de_id: quien.id, para_id: paraId || null, canal: esSoporte ? "soporte" : "psicologa" };
  if (hayTexto) payload.texto = String(texto).trim().slice(0, 2000);
  if (fecha) payload.fecha = fecha;

  if (respondeA) {
    // Se comprueba que el mensaje citado exista Y sea de esta misma conversación: si no, se
    // podría citar un mensaje ajeno y hacer que su texto apareciera —dentro de la cita— ante
    // alguien que nunca tuvo derecho a leerlo.
    const { data: citado } = await supabase
      .from("mensajes")
      .select("id, de_id, para_id, canal")
      .eq("id", respondeA)
      .single();

    // En soporte el hilo no lo definen "las dos partes" (el buzón no es una persona) sino EL
    // EMPLEADO: es él quien escribe y a quien se contesta. Si no, un encargado podría citar el
    // mensaje de un compañero dentro de la conversación de otro.
    const mismaConversacion = () => {
      if (!citado) return false;
      if (esSoporte) {
        if (citado.canal !== "soporte") return false;
        const empleadoDelHilo = paraId || quien.id;
        return citado.de_id === empleadoDelHilo || citado.para_id === empleadoDelHilo;
      }
      if (citado.canal === "soporte") return false;
      const dosPartes = [quien.id, paraId];
      return dosPartes.includes(citado.de_id) && dosPartes.includes(citado.para_id);
    };

    if (!mismaConversacion()) {
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

  if (esSoporte && !paraId) {
    // Va al buzón: se avisa a TODOS los que atienden soporte. Avisar solo a uno convertiría el
    // buzón en una lotería — si ese día no está, nadie se entera de que hay algo esperando.
    const { data: encargados } = await supabase
      .from("usuarios")
      .select("id, role")
      .eq("soporte_ti", true)
      .eq("inactivo", false);

    await Promise.all(
      (encargados || []).map((e) =>
        notificar(e.id, {
          tipo: "mensaje",
          titulo: `Soporte TI: ${quien.name}`,
          cuerpo: resumen,
          url: RUTA_POR_ROL[e.role] || "/",
        }).catch(() => {}),
      ),
    );
  } else {
    await notificar(paraId, {
      tipo: "mensaje",
      // En soporte, quien contesta lo hace COMO el canal y no como persona: para el empleado el
      // interlocutor es "Soporte TI". Dentro de la conversación sí se ve quién respondió.
      titulo: esSoporte ? "Respuesta de Soporte TI" : `Nuevo mensaje de ${quien.name}`,
      cuerpo: resumen,
      url: RUTA_POR_ROL[destinatario?.role] || "/",
    }).catch(() => {});
  }

  return res.status(200).json({ ok: true, mensaje });
}
