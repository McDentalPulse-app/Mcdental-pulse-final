import { TZ_CLINICA } from "./asistencia";

/**
 * Fechas del chat, siempre en la hora de la clínica.
 *
 * POR QUÉ NO SE PARTE LA CADENA: la versión anterior hacía `String(fecha).split(" ")[1]`
 * dando por hecho el formato "YYYY-MM-DD HH:MM". Es lo que el cliente ENVÍA, pero no lo que
 * la base DEVUELVE: `mensajes.fecha` es `timestamptz` y PostgREST la entrega como
 * "2026-07-25T16:16:00+00:00". Al no haber espacio, el split no encontraba nada y la interfaz
 * acababa mostrando el timestamp entero donde debía ir la hora.
 *
 * Y se fija la zona a la de la clínica en vez de usar la del navegador: un empleado que abra
 * la app con el teléfono en otra zona (o mal configurado) vería sus propios mensajes con horas
 * que no cuadran con su jornada.
 */

const fmtHora = new Intl.DateTimeFormat("es-MX", {
  timeZone: TZ_CLINICA, hour: "2-digit", minute: "2-digit", hour12: false,
});

const fmtDiaLargo = new Intl.DateTimeFormat("es-MX", {
  timeZone: TZ_CLINICA, weekday: "long", day: "numeric", month: "long",
});

// "en-CA" da "YYYY-MM-DD", que es justo lo que hace falta para comparar días como cadenas.
const fmtDiaClave = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_CLINICA, year: "numeric", month: "2-digit", day: "2-digit",
});

const aFecha = (valor) => {
  if (!valor) return null;
  // Se acepta también el "YYYY-MM-DD HH:MM" que el cliente manda, para que un mensaje recién
  // enviado se pinte igual antes de que vuelva de la base.
  const d = new Date(String(valor).includes("T") ? valor : String(valor).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "16:16" en hora de la clínica. Cadena vacía si la fecha no vale. */
export const horaCorta = (valor) => {
  const d = aFecha(valor);
  return d ? fmtHora.format(d) : "";
};

/** Clave de día "2026-07-25" para agrupar y comparar. */
export const claveDia = (valor) => {
  const d = aFecha(valor);
  return d ? fmtDiaClave.format(d) : "";
};

/** "Hoy", "Ayer" o "sábado, 25 de julio" para el separador entre bloques. */
export const etiquetaDia = (valor) => {
  const d = aFecha(valor);
  if (!d) return "";
  const hoy = fmtDiaClave.format(new Date());
  const ayer = fmtDiaClave.format(new Date(Date.now() - 86400000));
  const dia = fmtDiaClave.format(d);
  if (dia === hoy) return "Hoy";
  if (dia === ayer) return "Ayer";
  return fmtDiaLargo.format(d);
};

/** Minutos dentro de los cuales dos mensajes del mismo autor se pintan como un bloque. */
const VENTANA_GRUPO_MIN = 5;

/**
 * ¿`m` continúa el bloque de `anterior`? Mismo autor, mismo día y poco tiempo entre ambos.
 * Sirve para repetir el avatar y el nombre solo en el primero, como en Untitled UI.
 */
export const continuaGrupo = (m, anterior) => {
  if (!anterior || anterior.de !== m.de) return false;
  if (claveDia(anterior.fecha) !== claveDia(m.fecha)) return false;
  const a = aFecha(anterior.fecha);
  const b = aFecha(m.fecha);
  if (!a || !b) return false;
  return (b - a) / 60000 <= VENTANA_GRUPO_MIN;
};
