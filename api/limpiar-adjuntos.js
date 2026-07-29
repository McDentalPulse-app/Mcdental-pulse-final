import { configOk, admin } from "./_auth.js";
import { notificar } from "./_notificaciones.js";

/**
 * Retención de los adjuntos del chat empleado ↔ psicóloga. Lo llama un cron, no una persona.
 *
 * Hace dos cosas, en este orden:
 *   1. AVISA de los archivos a punto de caducar (a los 83 días), para que quien los quiera
 *      conservar pueda descargarlos.
 *   2. BORRA los de más de 90 días: el archivo se va del storage y la fila queda marcada.
 *
 * SE VA EL ARCHIVO, NO EL MENSAJE. El texto, las reacciones y las respuestas se quedan: son
 * la conversación. Lo que caduca es el adjunto, que es donde está el dato sensible de verdad
 * —una foto, un documento, la voz de alguien contándole algo a la psicóloga— y lo que la ley
 * pide no guardar más de lo necesario.
 *
 * POR QUÉ NO SE HACE EN SQL: igual que en limpiar-fotos.js, Storage no deja borrar objetos
 * desde la base (hay un trigger que lo impide para no dejar archivos huérfanos). Hay que ir
 * por su API, y eso exige la service role — que solo vive en el servidor.
 */

const DIAS_RETENCION = 90;
const DIAS_AVISO = 83;   // una semana de margen para descargarlo
const LOTE = 100;        // Storage borra en tandas; no se le mandan miles de rutas de golpe

const RUTA_POR_ROL = {
  admin: "/admin/mensajes",
  rh: "/rh/mensajes",
  psicologa: "/psicologa/mensajes",
  empleado: "/empleado/mensajes",
  doctor: "/doctor/mensajes",
};

const haceDias = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  // Sin este secreto cualquiera podría llamar al endpoint y forzar el borrado de los
  // adjuntos de los últimos tres meses — justo los que la gente todavía puede necesitar.
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("CRON_SECRET no configurado: rechazando por seguridad.");
    return res.status(500).json({ error: "Tarea no configurada." });
  }
  if (req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const supabase = admin();
  let avisados = 0;
  let borrados = 0;

  // ── 1. Avisar de lo que va a caducar ──────────────────────────────────────
  // Se avisa a las DOS partes: quien lo mandó puede querer conservarlo tanto como quien
  // lo recibió, y ninguno de los dos tiene por qué acordarse de que existe.
  const { data: porCaducar, error: errorAviso } = await supabase
    .from("mensajes")
    .select("id, de_id, para_id, adjunto_nombre, adjunto_mime")
    .lt("fecha", haceDias(DIAS_AVISO))
    .gte("fecha", haceDias(DIAS_RETENCION))
    .not("adjunto_path", "is", null)
    .eq("adjunto_purgado", false)
    .is("adjunto_aviso_en", null)
    .limit(LOTE * 5);

  if (errorAviso) {
    console.error("Error buscando adjuntos por caducar:", errorAviso);
  } else if (porCaducar?.length) {
    // Los roles hacen falta para saber a qué ruta mandar a cada quien.
    const ids = [...new Set(porCaducar.flatMap((m) => [m.de_id, m.para_id]))];
    const { data: personas } = await supabase.from("usuarios").select("id, role").in("id", ids);
    const rolDe = Object.fromEntries((personas || []).map((p) => [p.id, p.role]));

    for (const m of porCaducar) {
      const que = (m.adjunto_mime || "").startsWith("audio/")
        ? "Una nota de voz"
        : (m.adjunto_mime || "").startsWith("image/")
          ? "Una imagen"
          : `El archivo "${m.adjunto_nombre}"`;

      await Promise.all(
        [m.de_id, m.para_id].map((quien) =>
          notificar(quien, {
            tipo: "retencion",
            titulo: "Un archivo del chat se va a eliminar",
            cuerpo: `${que} de tu conversación se eliminará en 7 días. Descárgalo si lo necesitas.`,
            url: RUTA_POR_ROL[rolDe[quien]] || "/",
          })
        )
      );
    }

    // La marca va después de avisar: si esto muere a mitad, es mejor un aviso repetido que
    // un archivo que desaparece sin que nadie lo supiera.
    const { error: errorMarca } = await supabase
      .from("mensajes")
      .update({ adjunto_aviso_en: new Date().toISOString() })
      .in("id", porCaducar.map((m) => m.id));

    if (errorMarca) console.error("Error marcando los avisos:", errorMarca);
    else avisados = porCaducar.length;
  }

  // ── 2. Borrar lo que ya caducó ────────────────────────────────────────────
  const { data: viejos, error: errorConsulta } = await supabase
    .from("mensajes")
    .select("id, adjunto_path")
    .lt("fecha", haceDias(DIAS_RETENCION))
    .not("adjunto_path", "is", null)
    .eq("adjunto_purgado", false)
    .limit(LOTE * 10);

  if (errorConsulta) {
    console.error("Error buscando adjuntos que purgar:", errorConsulta);
    return res.status(500).json({ error: "No se pudieron buscar los adjuntos." });
  }

  for (let i = 0; i < (viejos?.length || 0); i += LOTE) {
    const lote = viejos.slice(i, i + LOTE);

    const { error: errorStorage } = await supabase.storage
      .from("mensajes")
      .remove(lote.map((m) => m.adjunto_path));

    if (errorStorage) {
      console.error("Error borrando adjuntos de Storage:", errorStorage);
      // Se sigue con la marca igualmente: un archivo que ya no existe —o que falló al
      // borrarse— no debe dejar la fila en un limbo que se reintente eternamente.
    }

    // La marca va DESPUÉS del borrado, no antes: si el proceso muere a mitad, es preferible
    // un archivo borrado sin marcar (el siguiente barrido lo reintenta) que uno marcado con
    // el archivo todavía ahí, que ya nadie volvería a mirar.
    //
    // `texto` no aparece aquí a propósito: el trigger de la migración 092 exige que quede
    // exactamente igual, para que la purga no pueda usarse como vía para reescribir nada.
    const { error: errorMarca } = await supabase
      .from("mensajes")
      .update({
        adjunto_purgado: true,
        adjunto_path: null,
        adjunto_nombre: null,
        adjunto_mime: null,
        adjunto_bytes: null,
        adjunto_meta: null,
      })
      .in("id", lote.map((m) => m.id));

    if (errorMarca) {
      console.error("Error marcando los adjuntos purgados:", errorMarca);
      return res.status(500).json({ error: "No se pudieron marcar los adjuntos." });
    }

    borrados += lote.length;
  }

  console.log(`Retención de adjuntos: ${avisados} avisados, ${borrados} borrados.`);
  return res.status(200).json({ ok: true, avisados, borrados });
}
