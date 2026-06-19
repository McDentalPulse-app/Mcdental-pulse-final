export const calcRiesgos = (empId, encuestas) => {
  const enc = encuestas.filter(e => e.empleadoId === empId).sort((a, b) => b.semana.localeCompare(a.semana));
  if (!enc.length) return { renuncia: 10, burnout: 10, emocional: 10, conflicto: 10 };

  const rec = enc.slice(0, 3);
  const avgEstres = rec.reduce((s, e) => s + (e.respuestas?.estres || 5), 0) / rec.length;
  const avgMot = rec.reduce((s, e) => s + (e.respuestas?.motivacion || 5), 0) / rec.length;
  const avgEmoc = rec.reduce((s, e) => s + (e.respuestas?.emocional || 5), 0) / rec.length;

  const renuncia = Math.min(95, Math.round(
    (rec.some(e => e.respuestas?.riesgoRenuncia === "Sí, seriamente") ? 60 : rec.some(e => e.respuestas?.riesgoRenuncia === "Algo") ? 30 : 10) +
    (10 - avgMot) * 3 + (10 - avgEmoc) * 2
  ));

  const burnout = Math.min(95, Math.round((avgEstres / 10) * 50 + (10 - avgMot) * 4 + (rec.some(e => !e.respuestas?.cargaManejable) ? 20 : 0)));
  const emocional = Math.min(95, Math.round((10 - avgEmoc) * 8 + (rec.some(e => e.respuestas?.problemasPersonales) ? 20 : 0)));
  const conflicto = Math.min(95, Math.round((10 - (rec.reduce((s, e) => s + (e.respuestas?.satisfaccion || 5), 0) / rec.length)) * 5 + avgEstres * 3));

  return { renuncia, burnout, emocional, conflicto };
};

export const calcPulseScore = (empId, encuestas) => {
  const enc = encuestas
    .filter((e) => e.empleadoId === empId)
    .filter((e) => Number.isFinite(Number(e.score)));

  if (!enc.length) {
    return {
      score: null,
      nivel: "Sin datos",
      color: "#94a3b8",
      tendencia: "→",
      sinDatos: true
    };
  }

  const recientes = [...enc]
    .sort((a, b) => b.semana.localeCompare(a.semana))
    .slice(0, 3);

  const avgScore = Math.round(
    recientes.reduce((s, e) => s + Number(e.score), 0) / recientes.length
  );

  const participacion = Math.min(100, Math.round((enc.length / 5) * 100));

  const riesgoRenuncia = recientes.some(
    (e) =>
      e.respuestas?.[9] === "Sí, seriamente" ||
      e.respuestas?.p9 === "Sí, seriamente"
  )
    ? -15
    : recientes.some(
        (e) => e.respuestas?.[9] === "Algo" || e.respuestas?.p9 === "Algo"
      )
    ? -5
    : 0;

  const problemasPersonales = recientes.some(
    (e) => e.respuestas?.[7] === "Sí" || e.respuestas?.p7 === "Sí"
  )
    ? -5
    : 0;

  const pulse = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        avgScore * 0.7 +
          participacion * 0.2 +
          10 +
          riesgoRenuncia +
          problemasPersonales
      )
    )
  );

  let nivel = "Rojo";
  let color = "#ef4444";

  if (pulse >= 80) {
    nivel = "Verde";
    color = "#22c55e";
  } else if (pulse >= 60) {
    nivel = "Amarillo";
    color = "#f59e0b";
  }

  const ultDos = [...enc]
    .sort((a, b) => b.semana.localeCompare(a.semana))
    .slice(0, 2);

  const tendencia =
    ultDos.length < 2
      ? "→"
      : Number(ultDos[0].score) > Number(ultDos[1].score)
      ? "↑"
      : Number(ultDos[0].score) < Number(ultDos[1].score)
      ? "↓"
      : "→";

  return { score: pulse, nivel, color, tendencia, sinDatos: false };
};

export const getPulseStatus = (score) => {
  if (score >= 80) {
    return {
      label: "Verde",
      semaforo: "Verde",
      color: "#22c55e",
      bg: "#dcfce7",
      nivel: "verde"
    };
  }

  if (score >= 60) {
    return {
      label: "Amarillo",
      semaforo: "Amarillo",
      color: "#f59e0b",
      bg: "#fef3c7",
      nivel: "amarillo"
    };
  }

  return {
    label: "Rojo",
    semaforo: "Rojo",
    color: "#ef4444",
    bg: "#fee2e2",
    nivel: "rojo"
  };
};

