import { configOk, admin, quienLlama } from "./_auth.js";
import { notificarGestion } from "./_notificaciones.js";

// La zona horaria de la empresa, no la del servidor (que corre en UTC). Importa: a las 19:00
// de Monterrey del 31 de agosto, en UTC ya es 1 de septiembre, y "el mes en curso" cambiaría
// medio día antes de tiempo para todo el mundo. Mismo criterio que api/tareas-programadas.js.
const TZ = "America/Monterrey";
const hoyLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

const mesDe = (iso) => iso.slice(0, 7);

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
 * (no exenta) piden la misma fecha destino, la segunda choca aquí con un 23505.
 *
 * La sucursal no se manda desde aquí: la sella un trigger desde el empleado (migración 113),
 * para que el cliente no pueda elegir en qué clínica cuenta su solicitud.
 *
 * Las DEMÁS reglas se comprueban abajo, en este mismo archivo: que el día cedido sea un
 * festivo intercambiable de verdad, la ventana de un mes de anticipación, y que el día que se
 * toma a cambio caiga en el mismo mes que el festivo. Estaban solo en la pantalla, y una regla
 * que solo vive en el navegador no es una regla: cualquiera con un POST a mano se la salta.
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
  if (fechaFestivo === fechaDestino) {
    return res.status(400).json({ error: "El día destino no puede ser el mismo festivo." });
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
  if (fechaFestivo < hoy) {
    return res.status(400).json({ error: "Ese festivo ya pasó." });
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
  // Un conmemorativo SÍ vale como día a cambio (se trabaja), igual que en la pantalla.
  if (enDestino && enDestino.tipo !== "conmemorativo") {
    return res.status(400).json({ error: "No puedes pedir a cambio un día que ya es festivo." });
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
    cuerpo: `${quien.name} pidió trabajar un festivo a cambio del ${destinoTxt}.`,
    url: { rh: "/rh/intercambios", admin: "/admin/intercambios", psicologa: "/psicologa/intercambios" },
  }).catch(() => {});

  return res.status(200).json({ ok: true, intercambio });
}
