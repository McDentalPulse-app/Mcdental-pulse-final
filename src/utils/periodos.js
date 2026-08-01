import { LAUNCH_WEEK, formatSemanaDisplay, getISOWeek, isoWeekToMonday } from "./constants";

/**
 * Los periodos que se pueden exportar: semana, quincena y mes — y cualquiera de los pasados,
 * no solo el que está en curso.
 *
 * Las tres duraciones NO se agrupan igual, y no es un descuido:
 *
 * · SEMANA — por la columna `semana` que ya trae cada encuesta (ISO, lunes a domingo). Es la
 *   agrupación exacta: es la misma semana con la que se guardó y con la que la encuesta se
 *   reinicia cada lunes. Ninguna encuesta puede caer en dos semanas.
 *
 * · QUINCENA — 14 días de SÁBADO a viernes, porque así se trabaja aquí (lunes a sábado) y así
 *   se paga. Eso no cuadra con la semana ISO, así que esta es la única que agrupa por la
 *   FECHA en que se contestó: una misma semana de encuesta puede repartirse entre dos
 *   quincenas. Es el precio de que el reporte cuadre con la nómina, y se paga a sabiendas.
 *   El anclaje es el sábado de la semana de lanzamiento (2026-07-04), así que las quincenas
 *   caen en 4–17 jul, 18–31 jul, 1–14 ago… y no se mueven nunca.
 *
 * · MES — todas las semanas cuyo LUNES cae en ese mes. Antes se filtraba por fecha de envío y
 *   eso partía las semanas a caballo entre dos meses: las encuestas de la W31 contestadas el
 *   27 de julio iban a julio y las de esa MISMA semana contestadas el 1 de agosto iban a
 *   agosto, así que ni un mes ni el otro tenían la semana completa. Con el lunes como
 *   criterio, una semana entera pertenece siempre a un solo mes.
 */

const DIA = 86400000;

/** Sábado de la semana de lanzamiento: el origen desde el que se cuentan las quincenas. */
const sabadoAncla = () => {
  const lunes = isoWeekToMonday(LAUNCH_WEEK);
  return lunes ? new Date(lunes.getTime() + 5 * DIA) : null;
};

const aISO = (fecha) => fecha.toISOString().slice(0, 10);

const desdeISO = (texto) => {
  const t = String(texto ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00Z`) : null;
};

/** La quincena que contiene esa fecha: { id, inicio, fin } en texto ISO. */
export const quincenaDe = (fechaISO) => {
  const fecha = desdeISO(fechaISO);
  const ancla = sabadoAncla();
  if (!fecha || !ancla) return null;
  const indice = Math.floor((fecha.getTime() - ancla.getTime()) / (14 * DIA));
  const inicio = new Date(ancla.getTime() + indice * 14 * DIA);
  const fin = new Date(inicio.getTime() + 13 * DIA);
  return { id: aISO(inicio), inicio: aISO(inicio), fin: aISO(fin) };
};

/** El mes ("YYYY-MM") al que pertenece una semana ISO: el de su lunes. */
export const mesDeSemana = (semana) => {
  const lunes = isoWeekToMonday(semana);
  return lunes ? aISO(lunes).slice(0, 7) : null;
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const diaMes = (iso) => {
  const f = desdeISO(iso);
  if (!f) return iso;
  return `${f.getUTCDate()} ${MESES[f.getUTCMonth()].slice(0, 3)}`;
};

/** El periodo al que pertenece una encuesta, con su etiqueta para el selector. */
export const periodoDe = (encuesta, tipo) => {
  if (tipo === "semana") {
    const id = String(encuesta?.semana || "").trim();
    if (!id) return null;
    const etiqueta = formatSemanaDisplay(id);
    // formatSemanaDisplay junta TODAS las semanas anteriores al lanzamiento bajo una sola
    // etiqueta "W00": en un selector eso son dos opciones escritas igual, imposible de
    // distinguir a ciegas. Para esas se muestra además la semana ISO real, que sí las separa.
    return { id, etiqueta: etiqueta.endsWith("W00") ? `${etiqueta} (${id})` : etiqueta };
  }
  if (tipo === "quincena") {
    const q = quincenaDe(encuesta?.fecha);
    return q ? { id: q.id, etiqueta: `${diaMes(q.inicio)} – ${diaMes(q.fin)}` } : null;
  }
  const id = mesDeSemana(encuesta?.semana) || String(encuesta?.fecha || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(id)) return null;
  return { id, etiqueta: `${MESES[Number(id.slice(5, 7)) - 1]} ${id.slice(0, 4)}` };
};

/** ¿Esta encuesta cae en ese periodo? */
export const encuestaEnPeriodo = (encuesta, tipo, id) => periodoDe(encuesta, tipo)?.id === id;

/**
 * Los periodos que se pueden elegir, del más reciente al más antiguo.
 *
 * Salen de las encuestas que hay, no de un calendario: un periodo sin una sola respuesta
 * exportaría una hoja vacía y solo sirve para hacer perder el tiempo. El periodo EN CURSO se
 * añade siempre aunque nadie haya contestado todavía — ahí la hoja vacía sí informa.
 */
export const periodosDisponibles = (encuestas = [], tipo = "semana") => {
  const hoy = { semana: getISOWeek(), fecha: aISO(new Date()) };
  const porId = new Map();
  for (const e of [hoy, ...encuestas]) {
    const p = periodoDe(e, tipo);
    if (p && !porId.has(p.id)) porId.set(p.id, p);
  }
  return [...porId.values()].sort((a, b) => String(b.id).localeCompare(String(a.id)));
};
