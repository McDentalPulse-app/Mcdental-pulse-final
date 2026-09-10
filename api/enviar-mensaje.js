import { configOk, admin, quienLlama } from "./_auth.js";
import { notificar } from "./_notificaciones.js";
import { primerEnlace, vistaPreviaEnlace } from "./_enlace.js";

/**
 * Envía un mensaje y avisa por push a quien lo recibe. Sirve a los TRES canales: el confidencial
 * empleado ↔ psicóloga, el buzón compartido de Soporte Sistemas (mig. 094, bandera por persona)
 * y el de Soporte Mantenimiento (mig. 155, por rol: admin/admin_plus/rh/psicóloga).
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
  // admin/admin_plus/rh también son destinatarios legítimos de este canal (esGestion, abajo) y
  // también pueden atender Soporte TI (bandera soporte_ti, independiente del rol): sin esta
  // entrada, al pulsar el aviso aterrizaban en "/" en vez de en su conversación.
  admin: "/admin/mensajes",
  admin_plus: "/admin/mensajes",
  rh: "/rh/mensajes",
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

  // Tres canales: 'psicologa' es la conversación confidencial 1 a 1 de siempre, y 'soporte'
  // (mig. 094) y 'mantenimiento' (mig. 155) son buzones compartidos. Cualquier otro valor se
  // trata como el de siempre en vez de rechazarse, para que un cliente viejo —que no manda
  // `canal`— siga enviando.
  const esSoporte = canal === "soporte";
  const esMantenimiento = canal === "mantenimiento";
  // Lo que comparten los dos buzones: se les escribe SIN destinatario (no son una persona) y la
  // respuesta sí va dirigida. Casi todas las ramas de abajo dependen de esto y no de cuál es.
  const esBuzon = esSoporte || esMantenimiento;

  // En un buzón, el personal escribe SIN destinatario: no es una persona. Solo la respuesta de
  // quien lo atiende lleva `paraId`.
  if ((!esBuzon && !paraId) || (!hayTexto && !adjunto?.path)) {
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
  // Los buzones tienen sus propias reglas y por eso se comprueban aparte:
  //   - cualquiera del personal escribe al buzón, sin destinatario;
  //   - quien lo ATIENDE contesta a una persona. En Sistemas eso lo concede la bandera
  //     `soporte_ti` aunque su rol sea `empleado` (mig. 094) — sin esta rama, la guarda de abajo
  //     se lo impediría precisamente a los dos encargados. En Mantenimiento lo concede el ROL
  //     (mig. 155), que es la misma lista de `esGestion`.
  const esGestion = (role) => ["admin", "admin_plus", "rh", "psicologa"].includes(role);
  if (esBuzon) {
    if (paraId && esSoporte && !quien.soporte_ti) {
      return res.status(403).json({ error: "Solo quien atiende Soporte Sistemas puede responder en ese canal." });
    }
    if (paraId && esMantenimiento && !esGestion(quien.role)) {
      return res.status(403).json({ error: "Solo quien atiende Soporte Mantenimiento puede responder en ese canal." });
    }
  } else if (["empleado", "doctor"].includes(quien.role) && !esGestion(destinatario.role)) {
    return res.status(403).json({ error: "No puedes enviar mensajes a otro empleado por este canal." });
  }

  const canalGuardado = esSoporte ? "soporte" : esMantenimiento ? "mantenimiento" : "psicologa";
  const payload = { de_id: quien.id, para_id: paraId || null, canal: canalGuardado };
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

    // En un buzón el hilo no lo definen "las dos partes" (el buzón no es una persona) sino LA
    // PERSONA que reportó: es quien escribe y a quien se contesta. Si no, quien atiende podría
    // citar el mensaje de un compañero dentro de la conversación de otro.
    //
    // Se compara contra `canalGuardado` y no contra un literal: así citar de un buzón al otro
    // queda cortado igual que citar de un buzón al canal de la psicóloga.
    const mismaConversacion = () => {
      if (!citado) return false;
      if (esBuzon) {
        if (citado.canal !== canalGuardado) return false;
        const personaDelHilo = paraId || quien.id;
        return citado.de_id === personaDelHilo || citado.para_id === personaDelHilo;
      }
      if (citado.canal !== "psicologa") return false;
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

  // Cómo se llama cada buzón de cara a quien recibe el aviso.
  const NOMBRE_BUZON = esMantenimiento ? "Soporte Mantenimiento" : "Soporte Sistemas";

  if (esBuzon && !paraId) {
    // Va al buzón: se avisa a TODOS los que lo atienden. Avisar solo a uno lo convertiría en una
    // lotería — si ese día no está, nadie se entera de que hay algo esperando.
    //
    // Quién atiende se resuelve distinto en cada uno, y es la única diferencia real entre los
    // dos: Sistemas por bandera (mig. 094), Mantenimiento por rol (mig. 155).
    const consulta = supabase.from("usuarios").select("id, role").eq("inactivo", false);
    const { data: encargados } = esMantenimiento
      ? await consulta.in("role", ["admin", "admin_plus", "rh", "psicologa"])
      : await consulta.eq("soporte_ti", true);

    await Promise.all(
      (encargados || [])
        // Quien reporta puede ser del propio equipo que atiende (un admin reportando algo de su
        // oficina): avisarle de su propio mensaje sería ruido.
        .filter((e) => e.id !== quien.id)
        .map((e) =>
          notificar(e.id, {
            tipo: "mensaje",
            titulo: `${NOMBRE_BUZON}: ${quien.name}`,
            cuerpo: resumen,
            url: RUTA_POR_ROL[e.role] || "/",
          }).catch(() => {}),
        ),
    );
  } else {
    await notificar(paraId, {
      tipo: "mensaje",
      // En un buzón, quien contesta lo hace COMO el canal y no como persona: para quien reportó,
      // el interlocutor es el buzón. Dentro de la conversación sí se ve quién respondió.
      titulo: esBuzon ? `Respuesta de ${NOMBRE_BUZON}` : `Nuevo mensaje de ${quien.name}`,
      cuerpo: resumen,
      url: RUTA_POR_ROL[destinatario?.role] || "/",
    }).catch(() => {});
  }

  return res.status(200).json({ ok: true, mensaje });
}
