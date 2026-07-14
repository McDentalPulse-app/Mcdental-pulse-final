import { configOk, admin, quienLlama } from "./_auth.js";
import { calcularHuella, similitud, UMBRAL_MISMA_PERSONA } from "./_rostro.js";

/**
 * Coteja la selfie de una checada contra la cara enrolada de ese empleado.
 *
 * La llama el checador justo después de fichar, y su resultado NO bloquea nada: la checada
 * ya está registrada. Aquí solo se escribe si la cara coincide o no.
 *
 * "¿Y si el cliente simplemente no llama a esto?" Entonces `rostro_verificado` se queda en
 * NULL, y una checada sin cotejar aparece MARCADA en el panel de RH. Saltárselo no ayuda a
 * nadie: cambia "no coincide" por "no se comprobó", y las dos cosas hacen que alguien la
 * mire. Por eso no hace falta un cron ni un webhook.
 *
 * El score lo calcula el servidor y lo escribe con la service role. El cliente nunca ve la
 * huella ni puede tocar el resultado: si pudiera, se pondría un 1.0 y esto sería teatro.
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

  const { checadaId } = req.body || {};
  if (!checadaId) {
    return res.status(400).json({ error: "Falta la checada." });
  }

  const supabase = admin();

  const { data: checada, error: errorChecada } = await supabase
    .from("asistencias")
    .select("id, empleado_id, selfie_path")
    .eq("id", checadaId)
    .single();

  if (errorChecada || !checada) {
    return res.status(404).json({ error: "Checada no encontrada." });
  }

  // Solo se coteja la checada de uno mismo (o RH cotejando a alguien). Sin esto, cualquiera
  // podría lanzar el cotejo de las checadas ajenas — no rompería nada, pero es gasto de CPU
  // regalado a quien quiera pedirlo.
  const esSuya = checada.empleado_id === quien.id;
  if (!esSuya && !["admin", "rh"].includes(quien.role)) {
    return res.status(403).json({ error: "No puedes cotejar esta checada." });
  }

  if (!checada.selfie_path) {
    // Se registró sin foto. No hay nada que cotejar; se queda sin verificar y RH la ve
    // marcada por ese motivo (requiereRevision ya cubre las checadas sin selfie).
    return res.status(200).json({ verificado: null, motivo: "sin_foto" });
  }

  const { data: rostro } = await supabase
    .from("rostros")
    .select("huella")
    .eq("empleado_id", checada.empleado_id)
    .single();

  if (!rostro) {
    // El empleado no está enrolado. No es culpa suya: es una tarea pendiente de RH.
    return res.status(200).json({ verificado: null, motivo: "no_enrolado" });
  }

  const { data: archivo, error: errorDescarga } = await supabase.storage
    .from("asistencias")
    .download(checada.selfie_path);

  if (errorDescarga || !archivo) {
    console.error("No se pudo descargar la selfie de la checada:", errorDescarga);
    return res.status(200).json({ verificado: null, motivo: "sin_foto" });
  }

  let huella;
  try {
    huella = await calcularHuella(Buffer.from(await archivo.arrayBuffer()));
  } catch (error) {
    console.error("Error calculando la huella de la checada:", error);
    return res.status(200).json({ verificado: null, motivo: "error" });
  }

  if (!huella) {
    // La foto se subió pero no se reconoce ninguna cara en ella (movida, a contraluz). No
    // se declara "no coincide": no es lo mismo que no coincida a que no se pudiera mirar.
    return res.status(200).json({ verificado: null, motivo: "sin_cara" });
  }

  const score = similitud(huella, rostro.huella);
  const verificado = score !== null && score >= UMBRAL_MISMA_PERSONA;

  const { error: errorUpdate } = await supabase
    .from("asistencias")
    .update({ match_score: score, rostro_verificado: verificado })
    .eq("id", checada.id);

  if (errorUpdate) {
    console.error("Error guardando el resultado del cotejo:", errorUpdate);
    return res.status(500).json({ error: "No se pudo guardar el resultado." });
  }

  // El score NO se le devuelve al empleado: saber exactamente cuánto se parece le daría a
  // quien quiera burlar el sistema una forma de ir probando hasta pasar el umbral.
  return res.status(200).json({ verificado });
}
