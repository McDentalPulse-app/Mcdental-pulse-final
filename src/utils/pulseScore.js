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
