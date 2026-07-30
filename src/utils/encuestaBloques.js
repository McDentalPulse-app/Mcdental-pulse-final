import { semanaNumero } from "./constants";

/**
 * Qué bloque de preguntas toca cada quincena.
 *
 * No hay calendario ni cron: el bloque se DERIVA de la semana. La misma semana da siempre
 * el mismo bloque, así que no hay estado que mantener, nada que se pueda quedar "sin
 * programar", y RH puede añadir bloques al banco sin tocar fechas.
 *
 * El ancla es LAUNCH_WEEK (ver constants.js), no el número de semana del año: contando
 * desde una semana fija, el salto de año no parte una quincena por la mitad — que es lo que
 * pasaría con `semanaISO / 2`, porque los años tienen 52 o 53 semanas.
 */

/** Quincena relativa al lanzamiento: W1 y W2 → Q1, W3 y W4 → Q2. null antes del lanzamiento. */
export const quincenaNumero = (week) => {
  const n = semanaNumero(week);
  return n == null ? null : Math.ceil(n / 2);
};

/**
 * El bloque que toca esa semana, o null si no hay ninguno aplicable.
 *
 * Devolver null es un estado NORMAL, no un error: con el banco vacío la encuesta es solo el
 * núcleo, que es exactamente la encuesta de siempre.
 *
 * El orden importa y es el que decide RH (`orden`), con el id como desempate para que dos
 * bloques con el mismo orden no roten de forma distinta en cada carga — sin eso, la
 * encuesta podría cambiar de bloque al refrescar la página.
 */
export const bloqueDeLaSemana = (week, bloques = []) => {
  const activos = bloques
    .filter((b) => b && b.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.id).localeCompare(String(b.id)));

  const q = quincenaNumero(week);
  if (!activos.length || q == null) return null;

  return activos[(q - 1) % activos.length];
};

/**
 * Separa las preguntas en las que puntúan y las que no.
 *
 * El Pulse Score es la media de las preguntas de escala, así que si una escala de un bloque
 * entra en el cálculo, el score deja de ser comparable con el de las quincenas anteriores —
 * y de esa comparación viven el historial, la tendencia y el foco rojo por sucursal. Por eso
 * el reparto se hace aquí, en un solo sitio, y no con un filtro suelto en cada pantalla.
 *
 * `nucleo` es lo que va al score. `delBloque` son las del bloque de esa semana, que se
 * responden y se reportan pero NO puntúan.
 */
export const repartirPreguntas = (preguntas = [], bloqueActivo = null) => {
  const nucleo = preguntas.filter((p) => !p.bloqueId);
  const delBloque = bloqueActivo
    ? preguntas.filter((p) => p.bloqueId === bloqueActivo.id)
    : [];

  return { nucleo, delBloque };
};

/** Las que se le muestran al empleado esa semana: núcleo primero, bloque después. */
export const preguntasDeLaSemana = (preguntas = [], bloqueActivo = null) => {
  const { nucleo, delBloque } = repartirPreguntas(preguntas, bloqueActivo);
  const activas = (lista) => lista.filter((p) => p.activa !== false);
  return [...activas(nucleo), ...activas(delBloque)];
};

/**
 * Áreas que pertenecen al núcleo y NO puede usar un bloque.
 *
 * El motor de riesgo localiza sus preguntas por área (ver encuestaDetail.js), así que si un
 * bloque usara "Riesgo" le robaría la fuente al riesgo de renuncia — la respuesta más
 * importante de la encuesta. Las demás están aquí porque son las series que la psicóloga
 * compara semana a semana: repetirlas en un bloque dejaría dos preguntas distintas
 * escribiendo en el mismo sitio del informe.
 */
export const AREAS_RESERVADAS = [
  "Riesgo",
  "Comentarios",
  "Emocional",
  "Estrés",
  "Liderazgo",
  "Motivación",
  "Relaciones",
  "Satisfacción",
  "Carga",
  "Personal",
];

const normalizarArea = (area) =>
  String(area || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** ¿Esta área es del núcleo? Compara sin tildes ni mayúsculas: "estres" == "Estrés". */
export const esAreaReservada = (area) =>
  AREAS_RESERVADAS.map(normalizarArea).includes(normalizarArea(area));

/**
 * ¿Alguien ya contestó esta pregunta?
 *
 * Se responde con las encuestas que la app ya tiene cargadas, sin ir a la base: el jsonb
 * `respuestas` está indexado por el id de la pregunta, así que basta con buscar la clave.
 *
 * Importa porque las respuestas se guardan por ID: cambiar el texto de una pregunta ya
 * contestada reescribe el pasado sin avisar — alguien respondió "8" a una frase que ya no
 * existe. Por eso el editor congela el texto en cuanto esto devuelve true.
 */
export const preguntaTieneRespuestas = (preguntaId, encuestas = []) => {
  if (preguntaId == null) return false;
  const clave = String(preguntaId);
  return encuestas.some((e) => {
    const r = e?.respuestas;
    if (!r || typeof r !== "object" || Array.isArray(r)) return false;
    const valor = r[clave];
    return valor !== undefined && valor !== null && valor !== "";
  });
};
