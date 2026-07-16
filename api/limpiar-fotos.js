import { admin, configOk } from "./_auth.js";

/**
 * Barrido de retención. Lo llama un cron de Vercel, no una persona.
 *
 * Borra:
 *   1. Las selfies de checada de más de 7 días. El REGISTRO de la checada se queda entero
 *      —hora, ubicación, si la cara coincidió, con cuánto parecido—: es un documento laboral.
 *      Lo que se va es la imagen, que ya no le sirve a nadie.
 *   2. Los intentos fallidos de cotejo de más de 30 días.
 *
 * POR QUÉ NO SE HACE EN SQL: Storage no deja borrar objetos desde la base (storage.objects
 * tiene un trigger que lo bloquea, precisamente para que no queden archivos huérfanos sin
 * fila que los referencie). Hay que ir por su API, y eso exige la service role — que solo
 * vive en el servidor.
 *
 * `foto_purgada` es la clave y no un detalle: si al borrar la foto se dejara `selfie_path` en
 * null a secas, TODAS las checadas de más de una semana pasarían a "requiere revisión" en el
 * panel de RH — porque una checada sin foto es un hueco sospechoso. El panel se llenaría de
 * ruido viejo y las alertas de verdad se perderían dentro.
 */

const DIAS_SELFIES = 7;
const DIAS_INTENTOS = 30;
const LOTE = 100; // Storage borra en tandas; no se le mandan 30.000 rutas de golpe

export default async function handler(req, res) {
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  // Vercel Cron manda este header. Sin él, cualquiera podría llamar al endpoint y forzar el
  // borrado de las fotos de esta semana — que son justo las que RH todavía puede necesitar.
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("CRON_SECRET no configurado: rechazando por seguridad.");
    return res.status(500).json({ error: "Tarea no configurada." });
  }
  if (req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const supabase = admin();
  const corte = new Date(Date.now() - DIAS_SELFIES * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // --- 1. Selfies de checada de más de una semana ---
  const { data: viejas, error: errorConsulta } = await supabase
    .from("asistencias")
    .select("id, selfie_path")
    .lt("fecha", corte)
    .not("selfie_path", "is", null)
    .eq("foto_purgada", false)
    .limit(LOTE * 10);

  if (errorConsulta) {
    console.error("Error buscando selfies que purgar:", errorConsulta);
    return res.status(500).json({ error: "No se pudieron buscar las fotos." });
  }

  let borradas = 0;

  for (let i = 0; i < (viejas?.length || 0); i += LOTE) {
    const lote = viejas.slice(i, i + LOTE);

    const { error: errorStorage } = await supabase.storage
      .from("asistencias")
      .remove(lote.map((a) => a.selfie_path));

    if (errorStorage) {
      console.error("Error borrando selfies de Storage:", errorStorage);
      // Se sigue con la marca igualmente: un archivo que ya no existe (o que falló al
      // borrarse) no debe dejar la fila en un limbo que reintente eternamente. El siguiente
      // barrido no la volverá a coger porque quedará marcada.
    }

    // La marca va DESPUÉS del borrado, no antes: si el proceso muere a mitad, es mejor tener
    // una foto borrada sin marcar (el siguiente barrido lo reintenta) que una marcada con la
    // foto todavía ahí (que ya nadie volvería a mirar).
    const { error: errorMarca } = await supabase
      .from("asistencias")
      .update({ selfie_path: null, foto_purgada: true })
      .in("id", lote.map((a) => a.id));

    if (errorMarca) {
      console.error("Error marcando las fotos purgadas:", errorMarca);
      return res.status(500).json({ error: "No se pudieron marcar las fotos." });
    }

    borradas += lote.length;
  }

  // --- 2. Intentos fallidos de cotejo viejos ---
  const corteIntentos = new Date(Date.now() - DIAS_INTENTOS * 24 * 60 * 60 * 1000).toISOString();
  const { error: errorIntentos, count: intentos } = await supabase
    .from("cotejo_intentos")
    .delete({ count: "exact" })
    .lt("creado_en", corteIntentos);

  if (errorIntentos) console.error("Error purgando los intentos de cotejo:", errorIntentos);

  console.log(`Retención: ${borradas} selfies borradas, ${intentos || 0} intentos purgados.`);

  return res.status(200).json({
    selfiesBorradas: borradas,
    intentosPurgados: intentos || 0,
    corte,
  });
}
