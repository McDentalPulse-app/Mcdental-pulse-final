import { readRiesgoRenuncia } from "./encuestaDetail";

const SCORE_SIN_DATOS = {
  score: null,
  promedio: null,
  nivel: "Sin datos",
  color: "#94a3b8",
  tendencia: "→",
  sinDatos: true,
};

const RIESGOS_SIN_DATOS = {
  sinDatos: true,
  renuncia: null,
  burnout: null,
  emocional: null,
  conflicto: null,
};

/**
 * Único predicado de "este score es un dato real".
 *
 * No usar `Number.isFinite(Number(x))` suelto: Number(null) === 0 y Number("") === 0,
 * así que una encuesta SIN score se colaba como un score de 0 — semáforo rojo y
 * prioridad "Crítica" para alguien de quien no sabemos nada. Esas filas existen: la
 * migración de Firestore escribió score: null cuando el origen no traía score
 * (scripts/migrate-firestore-to-supabase.mjs:317) y la columna es nullable.
 *
 * Ojo: 0 SÍ es válido — es una respuesta real, no un dato ausente.
 */
export const tieneScoreValido = (valor) =>
  valor !== null && valor !== undefined && valor !== "" && Number.isFinite(Number(valor));

/** Semáforo a partir del score. Mismos umbrales que getPulseStatus (80 / 60). */
export const semaforoDeScore = (score) =>
  score >= 80 ? "verde" : score >= 60 ? "amarillo" : "rojo";

/**
 * Calcula el Pulse Score de una encuesta: media de las preguntas de escala (1-10),
 * normalizada a 0-100.
 *
 * Devuelve un resultado explícito en vez de un número suelto, porque hay dos formas
 * de NO poder calcularlo y la UI las distingue:
 *   - `sin-preguntas-escala`: la encuesta no tiene ninguna pregunta de escala. Dividir
 *     entre cero daba NaN, que al serializarse a JSON viajaba como null y acababa
 *     guardando una encuesta sin score (y con semáforo "rojo", porque NaN >= 60 es falso).
 *   - `faltan-respuestas`: el empleado dejó alguna escala sin contestar.
 *
 * Nunca devuelve NaN.
 */
export const calcularScoreEncuesta = (preguntas = [], respuestas = {}) => {
  const escala = preguntas.filter((p) => p.tipo === "escala");
  if (!escala.length) {
    return { ok: false, motivo: "sin-preguntas-escala" };
  }

  const valores = escala
    .map((p) => Number(respuestas[p.id]))
    .filter((valor) => Number.isFinite(valor));

  if (valores.length !== escala.length) {
    return { ok: false, motivo: "faltan-respuestas" };
  }

  const suma = valores.reduce((acc, valor) => acc + valor, 0);
  const score = Math.round((suma / (escala.length * 10)) * 100);

  return { ok: true, score, semaforo: semaforoDeScore(score) };
};

export const getEmployeeSurveys = (employeeId, encuestas) =>
  encuestas
    .filter((e) => e.empleadoId === employeeId)
    .filter((e) => tieneScoreValido(e.score))
    .sort((a, b) => b.semana.localeCompare(a.semana));

export const getLatestEmployeeScore = (employeeId, encuestas) => {
  const surveys = getEmployeeSurveys(employeeId, encuestas);
  if (!surveys.length) return null;
  return Math.round(Number(surveys[0].score));
};

export const getEmployeeAverageScore = (employeeId, encuestas) => {
  const surveys = getEmployeeSurveys(employeeId, encuestas);
  if (!surveys.length) return null;
  const total = surveys.reduce((sum, e) => sum + Number(e.score), 0);
  return Math.round(total / surveys.length);
};

const riskFromBand = (score, bandMin, bandMax, riskMin, riskMax) => {
  const clamped = Math.max(bandMin, Math.min(bandMax, score));
  const ratio = (bandMax - clamped) / (bandMax - bandMin);
  return Math.round(riskMin + ratio * (riskMax - riskMin));
};

/**
 * Riesgos derivados del score, más el "bump" por la respuesta a "¿Has pensado en renunciar?".
 *
 * `preguntas` hace falta porque el jsonb `respuestas` se indexa por el ID de la pregunta (un
 * UUID en producción): sin la lista de preguntas no se sabe qué clave leer. Antes se buscaba
 * la clave numérica 9, que no existe en los datos, así que el bump NUNCA se aplicaba.
 * Sin `preguntas` sigue funcionando el fallback a las claves legacy.
 */
export const getEmployeeAIRisks = (score, encuestasEmpleado = [], preguntas = []) => {
  if (!tieneScoreValido(score)) {
    return { ...RIESGOS_SIN_DATOS };
  }

  const s = Number(score);
  let renuncia;
  let burnout;
  let emocional;

  if (s >= 85) {
    renuncia = riskFromBand(s, 85, 100, 5, 15);
    burnout = riskFromBand(s, 85, 100, 5, 20);
    emocional = riskFromBand(s, 85, 100, 5, 20);
  } else if (s >= 70) {
    renuncia = riskFromBand(s, 70, 84, 15, 30);
    burnout = riskFromBand(s, 70, 84, 20, 40);
    emocional = riskFromBand(s, 70, 84, 20, 40);
  } else if (s >= 50) {
    renuncia = riskFromBand(s, 50, 69, 30, 55);
    burnout = riskFromBand(s, 50, 69, 40, 65);
    emocional = riskFromBand(s, 50, 69, 40, 65);
  } else {
    renuncia = riskFromBand(s, 0, 49, 55, 85);
    burnout = riskFromBand(s, 0, 49, 65, 90);
    emocional = riskFromBand(s, 0, 49, 65, 90);
  }

  const latest = encuestasEmpleado[0];
  const riesgoRenunciaResp = readRiesgoRenuncia(latest, preguntas);

  if (riesgoRenunciaResp === "Sí, seriamente") {
    renuncia = Math.min(95, renuncia + 15);
  } else if (riesgoRenunciaResp === "Algo") {
    renuncia = Math.min(95, renuncia + 8);
  }

  const conflicto = Math.round((renuncia + burnout + emocional) / 3);

  return {
    sinDatos: false,
    renuncia,
    burnout,
    emocional,
    conflicto,
  };
};

export const calcRiesgos = (empId, encuestas, preguntas = []) => {
  const surveys = getEmployeeSurveys(empId, encuestas);
  const latestScore = getLatestEmployeeScore(empId, encuestas);
  return getEmployeeAIRisks(latestScore, surveys, preguntas);
};

export const getPulseStatus = (score) => {
  if (!tieneScoreValido(score)) {
    return {
      label: "Sin datos",
      semaforo: "Sin evaluación",
      color: "#94a3b8",
      bg: "#f1f5f9",
      nivel: "sin-datos",
    };
  }

  if (score >= 80) {
    return {
      label: "Estable",
      semaforo: "Verde",
      color: "#22c55e",
      bg: "#dcfce7",
      nivel: "verde",
    };
  }

  if (score >= 60) {
    return {
      label: "Atención",
      semaforo: "Amarillo",
      color: "#f59e0b",
      bg: "#fef3c7",
      nivel: "amarillo",
    };
  }

  return {
    label: "Crítico",
    semaforo: "Rojo",
    color: "#ef4444",
    bg: "#fee2e2",
    nivel: "rojo",
  };
};

export const getEmployeeStatus = getPulseStatus;

export const calcPulseScore = (empId, encuestas) => {
  const surveys = getEmployeeSurveys(empId, encuestas);

  if (!surveys.length) {
    return { ...SCORE_SIN_DATOS };
  }

  const score = getLatestEmployeeScore(empId, encuestas);
  const promedio = getEmployeeAverageScore(empId, encuestas);
  const status = getPulseStatus(score);

  const ultDos = surveys.slice(0, 2);
  const tendencia =
    ultDos.length < 2
      ? "→"
      : Number(ultDos[0].score) > Number(ultDos[1].score)
        ? "↑"
        : Number(ultDos[0].score) < Number(ultDos[1].score)
          ? "↓"
          : "→";

  return {
    score,
    promedio,
    nivel: status.label,
    color: status.color,
    tendencia,
    sinDatos: false,
  };
};
