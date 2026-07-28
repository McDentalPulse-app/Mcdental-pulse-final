import { configOk, admin, quienLlama } from "./_auth.js";

/**
 * Elimina un mensaje del canal empleado ↔ psicóloga: desaparece para las DOS partes.
 *
 * POR QUÉ PASA POR EL SERVIDOR Y NO ES UN UPDATE DESDE EL NAVEGADOR:
 *
 * La RLS de Postgres no distingue columnas. Una política `for update using (de_id = yo)` que
 * permitiera borrar dejaría también reescribir el `texto` del propio mensaje, sin rastro — en
 * un canal confidencial eso es peor que no poder borrar. Aquí la operación está acotada: se
 * comprueba la autoría, se limpian los campos exactos y no hay forma de tocar nada más.
 *
 * El borrado es BLANDO: el contenido se va de verdad (texto y adjunto a null, y el archivo
 * fuera del storage), pero la fila queda con su lápida. Que una de las partes pueda hacer
 * desaparecer sin rastro lo que dijo dejaría a la otra sin saber siquiera que hubo un mensaje.
 *
 * Solo borra QUIEN LO ESCRIBIÓ, y sin límite de tiempo. Lo primero es la regla evidente; lo
 * segundo es una decisión que conviene revisar: si se quiere una ventana (5 minutos, una hora),
 * el sitio es este.
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

  const { mensajeId } = req.body || {};
  if (!mensajeId) {
    return res.status(400).json({ error: "Falta el mensaje a eliminar." });
  }

  const supabase = admin();

  const { data: mensaje } = await supabase
    .from("mensajes")
    .select("id, de_id, adjunto_path, eliminado_en")
    .eq("id", mensajeId)
    .single();

  if (!mensaje) {
    return res.status(404).json({ error: "El mensaje no existe." });
  }
  if (mensaje.de_id !== quien.id) {
    return res.status(403).json({ error: "Solo puedes eliminar los mensajes que tú enviaste." });
  }
  if (mensaje.eliminado_en) {
    // Ya estaba: se contesta que sí en vez de dar error. Dos pestañas abiertas, o un doble
    // toque, no son un fallo que el usuario deba ver.
    return res.status(200).json({ ok: true, yaEstaba: true });
  }

  // El archivo primero. Si se limpiara la fila antes y esto fallara, el objeto quedaría
  // huérfano en el bucket sin nada que lo referencie: invisible e imposible de encontrar.
  if (mensaje.adjunto_path) {
    const { error: errorStorage } = await supabase.storage
      .from("mensajes")
      .remove([mensaje.adjunto_path]);
    if (errorStorage) {
      console.error("Error borrando el adjunto:", errorStorage);
      return res.status(500).json({ error: "No se pudo eliminar el archivo del mensaje." });
    }
  }

  // El trigger prevent_mensaje_tampering (migración 088) exige que esta transición venga
  // completa: lápida puesta Y contenido a null. Si falta algo, aborta.
  const { error } = await supabase
    .from("mensajes")
    .update({
      eliminado_en: new Date().toISOString(),
      eliminado_por: quien.id,
      texto: null,
      adjunto_path: null,
      adjunto_nombre: null,
      adjunto_mime: null,
      adjunto_bytes: null,
      adjunto_meta: null,
    })
    .eq("id", mensajeId);

  if (error) {
    console.error("Error eliminando el mensaje:", error);
    return res.status(500).json({ error: "No se pudo eliminar el mensaje." });
  }

  return res.status(200).json({ ok: true });
}
