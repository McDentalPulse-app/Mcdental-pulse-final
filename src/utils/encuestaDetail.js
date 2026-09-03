const OPEN_QUESTION_FALLBACK =
  "¿Quieres compartir algo más con el equipo de bienestar?";

import { normalizeWeek } from "./constants";

const SENSITIVE_KEYWORDS = [
  "renuncia",
  "acoso",
  "ansiedad",
  "depresión",
  "depresion",
  "burnout",
  "maltrato",
  "conflicto",
];

const LEGACY_FIELD_LABELS = {
  emocional: "Estado emocional",
  estres: "Estrés",
  estresLaboral: "Estrés laboral",
  satisfaccion: "Satisfacción",
  relaciones: "Relaciones con compañeros",
  liderazgo: "Relación con jefe directo",
  carga: "Carga de trabajo",
  personal: "Problema personal",
  motivacion: "Motivación",
  riesgoRenuncia: "Riesgo de renuncia",
  riesgo: "Riesgo de renuncia",
  comentario: "Comentario",
  comentarioAbierto: OPEN_QUESTION_FALLBACK,
  respuestaLibre: OPEN_QUESTION_FALLBACK,
  observaciones: "Observaciones",
  p1: "Pregunta 1",
  p2: "Pregunta 2",
  p3: "Pregunta 3",
  p4: "Pregunta 4",
  p5: "Pregunta 5",
  p6: "Pregunta 6",
  p7: "Pregunta 7",
  p8: "Pregunta 8",
  p9: "Riesgo de renuncia",
  p10: OPEN_QUESTION_FALLBACK,
};

const OPEN_COMMENT_ROOT_KEYS = [
  "comentarioAbierto",
  "respuestaLibre",
  "observaciones",
  "comentario",
];

const OPEN_COMMENT_RESPONSE_KEYS = [
  "comentarioAbierto",
  "respuestaLibre",
  "observaciones",
  "comentario",
  "abierta",
  "10",
];

const isEmpty = (val) =>
  val === undefined || val === null || String(val).trim() === "";

const readRespuesta = (respuestas, key) => {
  if (!respuestas) return undefined;
  if (Array.isArray(respuestas)) {
    const idx = Number(key) - 1;
    if (Number.isFinite(idx) && idx >= 0) return respuestas[idx];
    return undefined;
  }
  if (typeof respuestas !== "object") return undefined;
  return respuestas[key] ?? respuestas[String(key)];
};

export const getEncuestasEmpleado = (encuestas, empleadoId) =>
  (encuestas || [])
    .filter((e) => e.empleadoId === empleadoId)
    .slice()
    .sort((a, b) => {
      const bySemana = normalizeWeek(b.semana).localeCompare(normalizeWeek(a.semana));
      if (bySemana !== 0) return bySemana;
      return (b.fecha || "").localeCompare(a.fecha || "");
    });

export const formatEscalaValor = (valor) => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return String(valor ?? "—");
  let label;
  if (n >= 9) label = "Muy alto";
  else if (n >= 7) label = "Alto";
  else if (n >= 5) label = "Moderado";
  else if (n >= 3) label = "Bajo";
  else label = "Muy bajo";
  return `${n} · ${label}`;
};

export const formatRespuestaValor = (pregunta, valor) => {
  if (isEmpty(valor)) return "—";
  if (pregunta?.tipo === "escala") return formatEscalaValor(valor);
  return String(valor);
};

export const hasSensitiveContent = (text) => {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
};

export const getPreguntaAbierta = (preguntas = []) =>
  preguntas.find((p) => !p.bloqueId && /comentario/i.test(p.area || "")) ||
  preguntas.find((p) => !p.bloqueId && p.tipo === "abierta") ||
  null;

/**
 * La pregunta de riesgo de renuncia ("¿Has pensado en renunciar?").
 *
 * Se localiza por su ÁREA y acotada al NÚCLEO, no por su tipo. Antes era "la única de tipo
 * opcion de la encuesta", y eso deja de ser cierto en cuanto un bloque rotatorio añade otra
 * pregunta de opción: se la robaría, y el riesgo de renuncia pasaría a leerse de una pregunta
 * que no tiene nada que ver. El respaldo por tipo se conserva para filas viejas donde el
 * área pudiera venir vacía, pero también acotado al núcleo.
 *
 * `!p.bloqueId` cubre null, undefined y ausencia de la propiedad, así que sigue funcionando
 * con preguntas que vengan sin ese campo.
 */
export const getPreguntaRiesgoRenuncia = (preguntas = []) =>
  preguntas.find((p) => !p.bloqueId && /riesgo/i.test(p.area || "")) ||
  preguntas.find((p) => !p.bloqueId && p.tipo === "opcion") ||
  null;

/**
 * Lee la respuesta a la pregunta de riesgo de renuncia.
 *
 * El jsonb `respuestas` se indexa por el ID de la pregunta — en producción, un UUID. El
 * motor de riesgo lo leía con la clave numérica 9, que no existe en los datos, así que la
 * respuesta más importante de la encuesta se guardaba y se ignoraba: el bump de riesgo
 * nunca se aplicaba. Se lee por el id real, conservando las claves legacy por si quedara
 * alguna fila del dataset viejo.
 */
export const readRiesgoRenuncia = (encuesta, preguntas = []) => {
  const respuestas = encuesta?.respuestas;
  if (!respuestas) return null;

  const pregunta = getPreguntaRiesgoRenuncia(preguntas);
  if (pregunta) {
    const valor = readRespuesta(respuestas, pregunta.id);
    if (!isEmpty(valor)) return String(valor);
  }

  for (const legacy of [9, "p9", "riesgoRenuncia", "riesgo"]) {
    const valor = readRespuesta(respuestas, legacy);
    if (!isEmpty(valor)) return String(valor);
  }

  return null;
};

/**
 * Resumen compacto de las respuestas de escala: "Emocional=8, Estrés=6, Motivación=7".
 *
 * Lo usa el contexto que se manda a la IA, que hasta ahora leía `respuestas.emocional`,
 * `respuestas.estres` y `respuestas.motivacion` — claves del dataset legacy que NO existen
 * en un jsonb indexado por el id de la pregunta. El prompt salía literalmente con
 * "emocional=undefined, estres=undefined, mot=undefined".
 *
 * Solo el NÚCLEO entra aquí (decisión del 2026-07-29). El AI Engine compara semanas para
 * detectar "cambio de comportamiento" y "tendencia negativa", y un área que aparece durante
 * una quincena y desaparece en la siguiente es justo la clase de señal que dispararía una
 * alerta sin fundamento: no bajó nada, solo cambió el cuestionario. Por el mismo motivo por
 * el que un bloque no puntúa en el Pulse Score, tampoco entra en la serie que la IA compara.
 *
 * Las respuestas del bloque NO se pierden: siguen en el detalle de la encuesta y en el
 * expediente, que es donde la psicóloga las lee. Para incluirlas aquí, quitar `!p.bloqueId`.
 */
export const resumenEscalas = (encuesta, preguntas = []) =>
  preguntas
    .filter((p) => p.tipo === "escala" && !p.bloqueId)
    .map((p) => {
      const valor = readRespuesta(encuesta?.respuestas, p.id);
      if (isEmpty(valor)) return null;
      return `${p.area || p.texto || "Escala"}=${valor}`;
    })
    .filter(Boolean)
    .join(", ");

/** Igual que la anterior, para "¿Tienes algún problema personal...?" (la de tipo "sino" de área Personal). */
export const readProblemaPersonal = (encuesta, preguntas = []) => {
  const respuestas = encuesta?.respuestas;
  if (!respuestas) return null;

  const pregunta = preguntas.find((p) => p.tipo === "sino" && /personal/i.test(p.area || ""));
  if (pregunta) {
    const valor = readRespuesta(respuestas, pregunta.id);
    if (!isEmpty(valor)) return String(valor);
  }

  for (const legacy of [7, "p7", "personal"]) {
    const valor = readRespuesta(respuestas, legacy);
    if (!isEmpty(valor)) return String(valor);
  }

  return null;
};

const getPreguntaAbiertaTexto = (preguntas = []) =>
  getPreguntaAbierta(preguntas)?.texto || OPEN_QUESTION_FALLBACK;

const readValorAbierto = (encuesta, preguntas = []) => {
  if (!encuesta) return "";

  for (const key of OPEN_COMMENT_ROOT_KEYS) {
    const val = encuesta[key];
    if (!isEmpty(val)) return String(val).trim();
  }

  const abiertaPregunta = getPreguntaAbierta(preguntas);
  if (abiertaPregunta) {
    const fromPregunta = readRespuesta(encuesta.respuestas, abiertaPregunta.id);
    if (!isEmpty(fromPregunta)) return String(fromPregunta).trim();
  }

  if (
    encuesta.respuestas &&
    typeof encuesta.respuestas === "object" &&
    !Array.isArray(encuesta.respuestas)
  ) {
    for (const key of OPEN_COMMENT_RESPONSE_KEYS) {
      const val = encuesta.respuestas[key];
      if (!isEmpty(val)) return String(val).trim();
    }
  }

  if (Array.isArray(encuesta.respuestas)) {
    const abiertaIndex = preguntas.findIndex((p) => p.tipo === "abierta");
    const idx = abiertaIndex >= 0 ? abiertaIndex : encuesta.respuestas.length - 1;
    const val = encuesta.respuestas[idx];
    if (!isEmpty(val)) return String(val).trim();
  }

  return "";
};

export const getComentarioAbierto = (encuesta, preguntas = []) =>
  readValorAbierto(encuesta, preguntas);

/**
 * Una fila de respuesta abierta.
 *
 * `pregunta` es LA pregunta que se está pintando, y hay que pasarla. Antes no se pasaba: la
 * fila se construía siempre con el enunciado y el área de la abierta del núcleo, daba igual
 * cuál se estuviera procesando. Con un solo bloque rotatorio eso no se notaba; con los cuatro
 * que hay hoy —cuatro preguntas de tipo abierta en total— el comentario del núcleo salía
 * repetido cuatro veces, idéntico, en el detalle de cada encuesta.
 *
 * El respaldo a los campos sueltos (`comentarioAbierto`, `respuestaLibre`…) es SOLO de la
 * abierta del núcleo: de ahí vienen esos datos, de filas anteriores al jsonb. Aplicarlo a una
 * abierta de bloque es lo que hacía que heredara un comentario que no era suyo.
 */
const buildAbiertaItem = (encuesta, preguntas, numero, valor = "", pregunta = null) => {
  const propia = pregunta || getPreguntaAbierta(preguntas);
  const esNucleo = !propia?.bloqueId;
  const texto = valor || (esNucleo ? readValorAbierto(encuesta, preguntas) : "");
  const trimmed = isEmpty(texto) ? "" : String(texto).trim();

  return {
    numero,
    pregunta: propia?.texto || getPreguntaAbiertaTexto(preguntas),
    area: propia?.area || "Comentarios",
    tipo: "abierta",
    valor: trimmed || null,
    display: trimmed || "Sin respuesta.",
    revisar: hasSensitiveContent(trimmed),
    // Presentacional: el modal pinta el texto libre en su propia caja. Vale para todas.
    esAbierta: true,
    // Cuál es LA de siempre. La usa la garantía del final, que no puede darse por
    // satisfecha porque haya salido la abierta de un bloque.
    esComentarioNucleo: esNucleo,
  };
};

export const buildEncuestaDetalleItems = (encuesta, preguntas = []) => {
  if (!encuesta) return [];

  const raw = encuesta.respuestas;
  const items = [];
  const consumedKeys = new Set();

  if (preguntas.length && raw && typeof raw === "object") {
    preguntas.forEach((p, index) => {
      const numero = index + 1;

      if (p.tipo === "abierta") {
        const propia = readRespuesta(raw, p.id) ?? readRespuesta(raw, `p${p.id}`);

        // Una abierta de BLOQUE sin responder no se pinta, igual que cualquier otra pregunta
        // sin responder. Es la quincena la que decide qué bloque se pregunta, así que las de
        // los otros tres bloques están vacías siempre — y antes cada una copiaba el
        // comentario del núcleo.
        if (p.bloqueId && isEmpty(propia)) return;

        items.push(buildAbiertaItem(encuesta, preguntas, numero, propia ?? "", p));
        consumedKeys.add(String(p.id));
        consumedKeys.add(`p${p.id}`);
        return;
      }

      const valor =
        readRespuesta(raw, p.id) ??
        readRespuesta(raw, `p${p.id}`);

      if (isEmpty(valor)) return;

      items.push({
        numero,
        pregunta: p.texto,
        area: p.area,
        tipo: p.tipo,
        valor,
        display: formatRespuestaValor(p, valor),
        revisar: hasSensitiveContent(String(valor)),
      });
      consumedKeys.add(String(p.id));
      consumedKeys.add(`p${p.id}`);
    });
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([key, valor]) => {
      if (isEmpty(valor)) return;
      if (consumedKeys.has(key)) return;
      if (OPEN_COMMENT_RESPONSE_KEYS.includes(key)) return;

      const preguntaId = Number(key.replace(/^p/, ""));
      const matched = Number.isFinite(preguntaId)
        ? preguntas.find((p) => p.id === preguntaId)
        : null;

      if (matched?.tipo === "abierta") return;

      items.push({
        numero: matched?.id ?? items.length + 1,
        pregunta: matched?.texto || LEGACY_FIELD_LABELS[key] || "Pregunta registrada",
        area: matched?.area || "Encuesta",
        tipo: matched?.tipo || "texto",
        valor,
        display: matched ? formatRespuestaValor(matched, valor) : String(valor),
        revisar: hasSensitiveContent(String(valor)),
      });
    });
  }

  if (Array.isArray(raw) && !preguntas.length) {
    raw.forEach((valor, index) => {
      if (isEmpty(valor)) return;
      const pregunta = preguntas[index];
      if (pregunta?.tipo === "abierta") {
        items.push(buildAbiertaItem(encuesta, preguntas, index + 1, valor));
        return;
      }

      items.push({
        numero: index + 1,
        pregunta: pregunta?.texto || `Pregunta ${index + 1}`,
        area: pregunta?.area || "Encuesta",
        tipo: pregunta?.tipo || "texto",
        valor,
        display: pregunta ? formatRespuestaValor(pregunta, valor) : String(valor),
        revisar: hasSensitiveContent(String(valor)),
      });
    });
  }

  // El comentario abierto del NÚCLEO se muestra siempre, aunque venga vacío: que alguien no
  // haya escrito nada también es información. Se comprueba por `esComentarioNucleo` y no por
  // `esAbierta`, porque la abierta de un bloque no sustituye a la de siempre.
  if (!items.some((item) => item.esComentarioNucleo)) {
    const abiertaIdx = preguntas.findIndex((p) => p.tipo === "abierta" && !p.bloqueId);
    const numero = abiertaIdx >= 0 ? abiertaIdx + 1 : preguntas.length || 10;
    items.push(buildAbiertaItem(encuesta, preguntas, numero));
  }

  return items;
};

export const getEncuestaSemaforo = (encuesta) => {
  const sem = String(encuesta?.semaforo || "").toLowerCase();
  if (sem === "verde" || sem === "amarillo" || sem === "rojo") return sem;
  const score = Number(encuesta?.score);
  if (!Number.isFinite(score)) return "verde";
  if (score >= 80) return "verde";
  if (score >= 60) return "amarillo";
  return "rojo";
};

export const formatEncuestaFecha = (encuesta) =>
  encuesta?.fecha || encuesta?.respondidoEn || encuesta?.createdAt || "Sin fecha";
