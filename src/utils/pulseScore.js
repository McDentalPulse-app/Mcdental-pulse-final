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

export const getEmployeeSurveys = (employeeId, encuestas) =>
  encuestas
    .filter((e) => e.empleadoId === employeeId)
    .filter((e) => Number.isFinite(Number(e.score)))
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

export const getEmployeeAIRisks = (score, encuestasEmpleado = []) => {
  if (score == null || !Number.isFinite(Number(score))) {
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
  const riesgoRenunciaResp =
    latest?.respuestas?.[9] ??
    latest?.respuestas?.p9 ??
    latest?.respuestas?.riesgoRenuncia;

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

export const calcRiesgos = (empId, encuestas) => {
  const surveys = getEmployeeSurveys(empId, encuestas);
  const latestScore = getLatestEmployeeScore(empId, encuestas);
  return getEmployeeAIRisks(latestScore, surveys);
};

export const getPulseStatus = (score) => {
  if (score == null || !Number.isFinite(Number(score))) {
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
