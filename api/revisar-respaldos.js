import { configOk, admin } from "./_auth.js";
import { notificarGestion } from "./_notificaciones.js";

/**
 * Vigila el SILENCIO del respaldo externo. Lo llama un cron de la VPS, no una persona.
 *
 * respaldo-latido.js cubre el fallo ruidoso: la oficina copia, verifica, y avisa de que algo
 * salió mal. Pero el modo de fallo peligroso es el callado — la máquina de la oficina apagada
 * en vacaciones, sin red, o con el cron borrado. Entonces no llega ningún parte, no salta
 * ninguna alarma, y el respaldo externo lleva un mes sin existir mientras todo el mundo cree
 * que sí.
 *
 * De ahí que la ausencia de noticias sea aquí la noticia.
 *
 * NO ESCRIBE en respaldo_latidos a propósito: una fila de "silencio" pasaría a ser el último
 * latido y reiniciaría el contador cada día, dejando el aviso congelado en "1 día" para
 * siempre. El rastro queda en las notificaciones, que sí son persistentes.
 */

// 36 horas, no 24: el tirón es diario, pero un retraso por un arranque lento o un reinicio no
// debe disparar una alarma. Más de día y medio ya no es retraso.
const HORAS_TOLERANCIA = 36;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("CRON_SECRET no configurado: rechazando por seguridad.");
    return res.status(500).json({ error: "Tarea no configurada." });
  }
  if (req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const supabase = admin();
  const { data: ultimo, error } = await supabase
    .from("respaldo_latidos")
    .select("recibido_en, ok")
    .order("recibido_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error consultando los latidos:", error);
    return res.status(500).json({ error: "No se pudo consultar el estado del respaldo." });
  }

  const ahora = Date.now();
  const desde = ultimo ? new Date(ultimo.recibido_en).getTime() : null;
  const horas = desde === null ? null : (ahora - desde) / 3600000;

  // Nunca llegó ninguno: o se acaba de instalar, o nunca funcionó. Se avisa igual; es mejor
  // un aviso de más el primer día que descubrir en enero que esto jamás arrancó.
  if (horas === null || horas > HORAS_TOLERANCIA) {
    const dias = horas === null ? null : Math.floor(horas / 24);
    const cuanto =
      dias === null
        ? "Nunca se ha recibido uno."
        : dias >= 1
          ? `El último fue hace ${dias} ${dias === 1 ? "día" : "días"}.`
          : `El último fue hace ${Math.floor(horas)} horas.`;

    await notificarGestion({
      tipo: "respaldo",
      titulo: "No hay respaldo externo desde hace días",
      cuerpo: `La copia fuera del servidor no está llegando. ${cuanto} Revisa que la máquina de la oficina esté encendida y con red.`,
      url: { admin: "/admin", rh: "/rh", psicologa: "/psicologa" },
    });

    console.warn(`Respaldo externo en silencio: ${cuanto}`);
    return res.status(200).json({ ok: true, alarma: true, horas });
  }

  console.log(`Respaldo externo al día (hace ${horas.toFixed(1)} h, ok=${ultimo.ok}).`);
  return res.status(200).json({ ok: true, alarma: false, horas });
}
