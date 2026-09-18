import { configOk, admin, quienLlama } from "./_auth.js";
import { notificarGestion } from "./_notificaciones.js";

// La zona horaria de la empresa, no la del servidor (que corre en UTC). Importa: a las 19:00
// de Monterrey del 31 de agosto, en UTC ya es 1 de septiembre, y "el mes en curso" cambiaría
// medio día antes de tiempo para todo el mundo. Mismo criterio que api/tareas-programadas.js.
const TZ = "America/Monterrey";
const hoyLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

const mesDe = (iso) => iso.slice(0, 7);

// Un día antes de "YYYY-MM-DD", en UTC porque aquí solo interesa la fecha civil, no la hora
// (mismo criterio que mesSiguienteDe: Date resuelve solo el cruce de mes/año, incluido
// pasar del 1 de marzo al último día de febrero).
const diaAntesDe = (iso) => {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia - 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

// Mes siguiente a "YYYY-MM". Se apoya en Date para no tener que tratar el salto de diciembre
// a enero a mano; en UTC porque aquí solo interesan año y mes, no la hora.
const mesSiguienteDe = (mes) => {
  const [anio, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(anio, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * Un empleado/doctor aparta un festivo para cambiarlo por otro día (fecha_destino). Pasa por el
 * servidor para avisar a gestión por push. La EXCLUSIVIDAD del destino la garantiza el índice
 * único parcial `(sucursal, fecha_destino)` de la migración 113 (por sucursal, no global) más
 * la excepción de la 151: Oficina Administrativa — y sus alias legacy "Oficina Central"/
 * "Central" — queda totalmente fuera, ni entre sí choca. Si dos personas DE LA MISMA sucursal
 * (no exenta) piden la misma fecha destino, la segunda choca aquí con un 23505. Excepción de la
 * 152: si fecha_destino = fecha_festivo (avisar que no vienes, sin canje real) tampoco compite
 * con nadie — no es un recurso escaso, es un festivo libre para todos.
 *
 * La sucursal no se manda desde aquí: la sella un trigger desde el empleado (migración 113),
 * para que el cliente no pueda elegir en qué clínica cuenta su solicitud.
 *
 * Las DEMÁS reglas se comprueban abajo, en este mismo archivo: que el día cedido sea un
 * festivo intercambiable de verdad, que caiga en el mes en curso o el siguiente, y que el día
 * que se toma a cambio esté en el mismo mes que el festivo. Estaban solo en la pantalla, y una
 * regla que solo vive en el navegador no es una regla: cualquiera con un POST a mano se la salta.
 *
 * Un festivo del mes en curso se puede pedir aunque YA HAYA PASADO (antes solo se podía apartar
 * con anticipación; se reportó como falla que, pasado el 16 de septiembre, ya no dejaba
 * intercambiarlo el resto del mes).
 *
 * Cada festivo se usa UNA sola vez por persona (si el mes trae dos, se puede usar dos veces —
 * una por festivo). No se valida checada ni asistencia, a propósito: eso es un tema aparte. Lo
 * que se comprueba es que ni este festivo ni el día anterior hayan sido YA parte de otro
 * intercambio suyo sin rechazar — ni como festivo cedido (para no pedir el mismo dos veces) ni
 * como fecha_destino (para no decir "lo trabajé" de un día que ya cobró libre por otra vía).
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
  if (!["empleado", "doctor"].includes(quien.role)) {
    return res.status(403).json({ error: "Solo el personal puede solicitar un intercambio de día." });
  }

  const { fechaFestivo, fechaDestino } = req.body || {};
  const fechaOk = (f) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
  if (!fechaOk(fechaFestivo) || !fechaOk(fechaDestino)) {
    return res.status(400).json({ error: "Faltan fechas o el formato no es válido." });
  }
  const supabase = admin();

  // --- Las reglas, aquí y no solo en la pantalla -----------------------------
  // Hasta ahora esto vivía únicamente en el navegador: el endpoint aceptaba cualquier par de
  // fechas, así que un POST a mano podía apartar la Navidad en agosto, o pedir a cambio un
  // día de otro mes. Lo que la interfaz impide tiene que impedirlo también el servidor, o no
  // es una regla: es una sugerencia.
  const hoy = hoyLocal();

  const { data: fechasFestivas, error: errorFestivos } = await supabase
    .from("festivos")
    .select("fecha, nombre, tipo")
    .in("fecha", [fechaFestivo, fechaDestino]);

  if (errorFestivos) {
    console.error("Error consultando festivos:", errorFestivos);
    return res.status(500).json({ error: "No se pudo validar tu solicitud." });
  }

  const cedido = (fechasFestivas || []).find((f) => f.fecha === fechaFestivo);
  const enDestino = (fechasFestivas || []).find((f) => f.fecha === fechaDestino);

  if (!cedido) {
    return res.status(400).json({ error: "El día que quieres ceder no es un festivo." });
  }
  // Un conmemorativo (Día del Abuelo, Día de Muertos…) se trabaja: no hay nada que ceder.
  if (cedido.tipo === "conmemorativo") {
    return res.status(400).json({ error: `${cedido.nombre} es conmemorativo: ese día se trabaja, no se puede intercambiar.` });
  }
  // Un mes de anticipación: el festivo tiene que caer en el mes en curso o en el siguiente.
  const mesHoy = mesDe(hoy);
  const mesFestivo = mesDe(fechaFestivo);
  if (mesFestivo !== mesHoy && mesFestivo !== mesSiguienteDe(mesHoy)) {
    return res.status(400).json({ error: "Un festivo solo se puede apartar con un mes de anticipación." });
  }

  // El día que se toma a cambio, dentro del mismo mes que el festivo.
  if (mesDe(fechaDestino) !== mesFestivo) {
    return res.status(400).json({ error: "El día que pides a cambio tiene que ser del mismo mes que el festivo." });
  }
  if (fechaDestino <= hoy) {
    return res.status(400).json({ error: "El día que pides a cambio tiene que ser posterior a hoy." });
  }
  // Un conmemorativo SÍ vale como día a cambio (se trabaja), igual que en la pantalla. Y pedir
  // el MISMO festivo como destino también vale — no es un canje, es avisar que no vienes ese
  // día (ver migración 152); lo único que sigue sin sentido es pedir un festivo DISTINTO.
  if (fechaDestino !== fechaFestivo && enDestino && enDestino.tipo !== "conmemorativo") {
    return res.status(400).json({ error: "No puedes pedir a cambio un día que ya es festivo." });
  }

  // Cada festivo se usa una sola vez: ni como festivo cedido (fecha_festivo) en otra solicitud
  // suya, ni como fecha_destino de otra (ese día, o el anterior, ya se cobraron libres por otra
  // vía). "sin rechazar" porque un intercambio rechazado no cuenta como usado.
  const diaAnterior = diaAntesDe(fechaFestivo);
  const { data: yaUsado, error: errorYaUsado } = await supabase
    .from("intercambios_dia")
    .select("id, fecha_festivo, fecha_destino")
    .eq("empleado_id", quien.id)
    .neq("estado", "rechazado")
    .or(`fecha_festivo.eq.${fechaFestivo},fecha_destino.eq.${fechaFestivo},fecha_destino.eq.${diaAnterior}`);

  if (errorYaUsado) {
    console.error("Error validando intercambios previos:", errorYaUsado);
    return res.status(500).json({ error: "No se pudo validar tu solicitud." });
  }
  if (yaUsado?.length) {
    return res.status(400).json({
      error: "Ese festivo (o el día anterior) ya lo usaste en otro intercambio: cada festivo se puede usar una sola vez.",
    });
  }

  const { data: intercambio, error } = await supabase
    .from("intercambios_dia")
    .insert({ empleado_id: quien.id, fecha_festivo: fechaFestivo, fecha_destino: fechaDestino })
    .select("*")
    .single();

  if (error) {
    // 23505 = violación de índice único: alguien ya apartó ese día destino.
    if (error.code === "23505") {
      return res.status(409).json({ error: "Alguien de tu clínica ya apartó ese día. Elige otro." });
    }
    console.error("Error solicitando intercambio:", error);
    return res.status(500).json({ error: "No se pudo registrar tu solicitud." });
  }

  const destinoTxt = new Date(`${fechaDestino}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  });

  await notificarGestion({
    tipo: "intercambio",
    titulo: "Solicitud de intercambio de día",
    cuerpo: fechaDestino === fechaFestivo
      ? `${quien.name} avisó que no trabajará el ${destinoTxt}.`
      : `${quien.name} pidió trabajar un festivo a cambio del ${destinoTxt}.`,
    url: { rh: "/rh/intercambios", admin: "/admin/intercambios", psicologa: "/psicologa/intercambios" },
  }).catch(() => {});

  return res.status(200).json({ ok: true, intercambio });
}
