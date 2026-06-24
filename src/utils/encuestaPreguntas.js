const TIPOS_VALIDOS = new Set(["escala", "sino", "opcion", "abierta"]);

export const DEFAULT_OPCIONES_RIESGO = ["No", "Algo", "Sí, seriamente"];

export const normalizePregunta = (pregunta, index = 0) => {
  const id = Number(pregunta?.id) || index + 1;
  const tipo = TIPOS_VALIDOS.has(pregunta?.tipo) ? pregunta.tipo : "escala";
  const orden = Number(pregunta?.orden ?? pregunta?.id ?? index + 1);

  return {
    id,
    texto: String(pregunta?.texto ?? pregunta?.pregunta ?? "").trim(),
    tipo,
    area: String(pregunta?.area ?? "General").trim(),
    orden,
    activa: pregunta?.activa !== false,
    firebaseId: pregunta?.firebaseId || null,
    ...(tipo === "opcion"
      ? {
          opciones: Array.isArray(pregunta?.opciones) && pregunta.opciones.length
            ? pregunta.opciones.map((o) => String(o).trim()).filter(Boolean)
            : [...DEFAULT_OPCIONES_RIESGO],
        }
      : {}),
  };
};

export const normalizePreguntasList = (preguntas = []) =>
  (preguntas || [])
    .map((p, index) => normalizePregunta(p, index))
    .sort((a, b) => a.orden - b.orden || a.id - b.id);

export const getPreguntasActivas = (preguntas = []) =>
  normalizePreguntasList(preguntas).filter((p) => p.activa !== false);

export const preguntaToFirestore = (pregunta) => {
  const base = {
    id: pregunta.id,
    texto: pregunta.texto,
    tipo: pregunta.tipo,
    area: pregunta.area || "General",
    orden: pregunta.orden ?? pregunta.id,
    activa: pregunta.activa !== false,
  };

  if (pregunta.tipo === "opcion") {
    base.opciones =
      Array.isArray(pregunta.opciones) && pregunta.opciones.length
        ? pregunta.opciones
        : [...DEFAULT_OPCIONES_RIESGO];
  }

  return base;
};
