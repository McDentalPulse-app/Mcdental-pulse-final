import { configOk, admin, quienLlama } from "./_auth.js";
import { retoAlAzar, PROBABILIDAD_RETO } from "./_pose.js";

/**
 * ¿A esta persona le toca girar la cabeza antes de checar?
 *
 * El checador pregunta esto ANTES de abrir la cámara, porque necesita saber si tiene que capturar
 * una foto o dos. La respuesta la decide el servidor y la GUARDA — y ahí está todo el truco.
 *
 * EL AGUJERO QUE ESTE ENDPOINT CIERRA:
 *
 * Un reto al azar que se pueda volver a sortear no es un reto: es un peaje que basta con esperar
 * a que no esté. El impostor pide checada, le sale reto, falla (o simplemente cancela), vuelve a
 * pedir... y 4 de cada 5 veces le sale "sin reto" y entra tan tranquilo.
 *
 * Por eso el dado SOLO SE TIRA UNA VEZ. En cuanto sale un reto, se escribe en `rostros.
 * reto_pendiente` y a partir de ahí este endpoint devuelve SIEMPRE ese mismo reto, llamada tras
 * llamada, hasta que la persona lo supere de verdad en /api/checar. No hay forma de esquivarlo
 * reintentando, que es exactamente la forma en que un tramposo lo intentaría.
 *
 * Quien no tiene rostro aprobado no recibe reto: no hay contra qué cotejar la foto girada, y un
 * reto sin cotejo no comprueba nada — solo estorba.
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

  const supabase = admin();

  const { data: rostro } = await supabase
    .from("rostros")
    .select("id, reto_pendiente")
    .eq("empleado_id", quien.id)
    .eq("estado", "aprobado")
    .maybeSingle();

  if (!rostro) return res.status(200).json({ reto: null });

  // Ya tenía uno pendiente: se le devuelve EL MISMO. No se vuelve a sortear.
  if (rostro.reto_pendiente) {
    return res.status(200).json({ reto: rostro.reto_pendiente });
  }

  if (Math.random() >= PROBABILIDAD_RETO) {
    return res.status(200).json({ reto: null });
  }

  const reto = retoAlAzar();

  const { error } = await supabase
    .from("rostros")
    .update({ reto_pendiente: reto, reto_pedido_en: new Date().toISOString() })
    .eq("id", rostro.id);

  if (error) {
    // Si no se pudo GUARDAR el reto, no se pide: un reto que el servidor no recuerda es un reto
    // que el cliente podría decir que superó, y eso no vale nada. Antes sin reto que con uno de
    // mentira.
    console.error("No se pudo guardar el reto:", error);
    return res.status(200).json({ reto: null });
  }

  return res.status(200).json({ reto });
}
