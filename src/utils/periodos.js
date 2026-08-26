import {
  LAUNCH_WEEK, formatSemanaDisplay, getISOWeek, isoWeekToMonday,
  claveDePeriodo, claveDelPeriodo, esPeriodoQuincenal,
} from "./constants";
import { quincenaNumero } from "./encuestaBloques";
import { FIN_PERIODO_PRUEBA } from "./asistencia";

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

/**
 * Cómo se llama un periodo cuando va SOLO en un encabezado.
 *
 * Distinta de la del selector (`periodoDe`) porque el problema es distinto: en una lista de
 * opciones lo que hace falta es distinguirlas de un vistazo, y en un encabezado lo que hace falta
 * es que se entienda sin contexto. De ahí que esta diga «Semana» o «Quincena» dentro del texto:
 * quien la use no tiene que anteponer nada, y así no salen cosas como «Semana Quincena 4».
 */
export const etiquetaDePeriodo = (clave) => {
  const id = claveDePeriodo(String(clave ?? "").trim());
  if (!id) return "";
  if (esPeriodoQuincenal(id)) {
    return `Quincena ${quincenaNumero(id)} · ${diaMes(inicioDePeriodo("semana", id))} – ${diaMes(finDePeriodo("semana", id))}`;
  }
  return `Semana ${formatSemanaDisplay(id)}`;
};

/** El periodo al que pertenece una encuesta, con su etiqueta para el selector. */
export const periodoDe = (encuesta, tipo) => {
  if (tipo === "semana") {
    // NORMALIZAR AQUÍ ES LO QUE ARREGLA TRES COSAS A LA VEZ. Desde el corte quincenal, la
    // segunda semana del par apunta a la primera, que es la clave con la que se guardan las
    // encuestas. Sin esto: `periodosDisponibles` ofrecía un «periodo actual» (la semana cruda)
    // que no empataba con ninguna encuesta guardada, y `periodosEnRango` partía cada quincena en
    // dos opciones del selector. Los dos llaman aquí, así que los dos quedan arreglados.
    const id = claveDePeriodo(String(encuesta?.semana || "").trim());
    if (!id) return null;
    // Desde el corte el periodo son DOS semanas, y llamarlo «2026-W07» invita a leer un número
    // de quincena como si fuera de semana. Se dice lo que es y cuándo empieza y acaba.
    if (esPeriodoQuincenal(id)) {
      const q = quincenaNumero(id);
      return {
        id,
        etiqueta: `Quincena ${q} · ${diaMes(inicioDePeriodo("semana", id))} – ${diaMes(finDePeriodo("semana", id))}`,
      };
    }
    const etiqueta = formatSemanaDisplay(id);
    // formatSemanaDisplay junta TODAS las semanas anteriores al lanzamiento bajo una sola
    // etiqueta "W00": en un selector eso son dos opciones escritas igual, imposible de
    // distinguir a ciegas. Para esas se muestra además la semana ISO real, que sí las separa.
    //
    // Las semanas normales conservan su etiqueta corta a propósito (hay un test que lo fija):
    // son historial ya leído, y reescribirlo ahora cambiaría lo que RH lleva semanas viendo.
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
  // `claveDelPeriodo()` y no `getISOWeek()`: es la misma clave con la que se GUARDA una encuesta
  // nueva, así que la opción «periodo en curso» empata con lo que hay en la base. Con la semana
  // cruda, en la segunda semana de la quincena esa opción salía vacía.
  const hoy = { semana: claveDelPeriodo(), fecha: aISO(new Date()) };
  const porId = new Map();
  for (const e of [hoy, ...encuestas]) {
    const p = periodoDe(e, tipo);
    if (p && !porId.has(p.id)) porId.set(p.id, p);
  }
  return [...porId.values()].sort((a, b) => String(b.id).localeCompare(String(a.id)));
};

/** Primer día del periodo, en texto ISO. */
export const inicioDePeriodo = (tipo, id) => {
  if (tipo === "quincena") return /^\d{4}-\d{2}-\d{2}$/.test(String(id)) ? String(id) : null;
  if (tipo === "mes") return /^\d{4}-\d{2}$/.test(String(id)) ? `${id}-01` : null;
  const lunes = isoWeekToMonday(id);
  return lunes ? aISO(lunes) : null;
};

/** Último día del periodo, en texto ISO. */
export const finDePeriodo = (tipo, id) => {
  if (tipo === "quincena") {
    const inicio = desdeISO(id);
    return inicio ? aISO(new Date(inicio.getTime() + 13 * DIA)) : null;
  }
  if (tipo === "mes") {
    const [anio, mes] = String(id).split("-").map(Number);
    return anio && mes ? aISO(new Date(Date.UTC(anio, mes, 0))) : null;
  }
  const lunes = isoWeekToMonday(id);
  if (!lunes) return null;
  // 13 días más cuando la clave es quincenal: el periodo llega hasta el domingo de la SEGUNDA
  // semana. Devolver lunes+6 para una quincena no era solo una etiqueta corta — este valor acota
  // el rango del reporte de asistencia, así que la segunda semana se quedaba fuera de la hoja.
  const dias = esPeriodoQuincenal(id) ? 13 : 6;
  return aISO(new Date(lunes.getTime() + dias * DIA));
};

/**
 * ¿Este periodo cae entero dentro del periodo de prueba de la app?
 *
 * Sirve para distinguir dos silencios que en la hoja se veían igual: quien no contestó
 * pudiendo hacerlo, y quien no contestó porque la app todavía se estaba probando. El
 * criterio es que el periodo TERMINE dentro de la prueba; uno que la cruza (la semana del
 * 27 de julio al 2 de agosto) ya cuenta como normal, porque en su segunda mitad sí se
 * podía contestar.
 */
export const esPeriodoDePrueba = (tipo, id) => {
  const fin = finDePeriodo(tipo, id);
  return !!fin && fin <= FIN_PERIODO_PRUEBA;
};

/**
 * Los periodos que cubren un rango de fechas, del más reciente al más antiguo.
 *
 * La otra lista —periodosDisponibles— sale de las encuestas que hay, y para el reporte de
 * asistencia eso no vale: un periodo sin encuestas puede tener diez días de checadas. Aquí
 * los periodos salen del calendario, entre la fecha en que se empezó a checar y hoy.
 */
export const periodosEnRango = (tipo, desde, hasta) => {
  const fin = desdeISO(hasta);
  let cursor = desdeISO(desde);
  if (!cursor || !fin) return [];
  const vistos = new Map();
  // Se avanza día a día y se pregunta a qué periodo pertenece cada uno: así no hay que
  // escribir tres bucles distintos (semana, quincena y mes no duran lo mismo).
  while (cursor <= fin) {
    const p = periodoDe({ semana: getISOWeek(cursor), fecha: aISO(cursor) }, tipo);
    if (p && !vistos.has(p.id)) vistos.set(p.id, p);
    cursor = new Date(cursor.getTime() + DIA);
  }
  return [...vistos.values()].sort((a, b) => String(b.id).localeCompare(String(a.id)));
};
