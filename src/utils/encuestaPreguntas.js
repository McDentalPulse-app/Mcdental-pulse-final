const TIPOS_VALIDOS = new Set(["escala", "sino", "opcion", "abierta"]);

export const DEFAULT_OPCIONES_RIESGO = ["No", "Algo", "Sí, seriamente"];

// Cuánto cuenta una pregunta en el Pulse Score. Entero de 1 a 5, igual que la columna
// `peso` (migración 159): con pesos enteros la suma ponderada es exacta tanto en el
// `numeric` del servidor como en el float64 del navegador, así que los dos cálculos no
// pueden divergir en un empate de redondeo — y el empleado no ve un score que luego cambia.
export const PESO_MIN = 1;
export const PESO_MAX = 5;

/** Cualquier cosa a un peso válido. Lo que no sea un número usable cuenta como 1. */
export const normalizePeso = (peso) => {
  const n = Math.round(Number(peso));
  if (!Number.isFinite(n)) return PESO_MIN;
  return Math.min(PESO_MAX, Math.max(PESO_MIN, n));
};

export const normalizePregunta = (pregunta, index = 0) => {
  const id = pregunta?.id ?? index + 1;
  const tipo = TIPOS_VALIDOS.has(pregunta?.tipo) ? pregunta.tipo : "escala";
  const orden = Number(pregunta?.orden ?? index + 1);

  return {
    id,
    texto: String(pregunta?.texto ?? pregunta?.pregunta ?? "").trim(),
    tipo,
    area: String(pregunta?.area ?? "General").trim(),
    orden,
    activa: pregunta?.activa !== false,
    // Se preserva explícitamente: este objeto se construye campo por campo, así que si
    // bloqueId no se enumera aquí desaparece, la pregunta pasa por ser del núcleo y sus
    // escalas entran al Pulse Score. `?? null` normaliza undefined a null.
    bloqueId: pregunta?.bloqueId ?? null,
    // Mismo motivo que bloqueId: si no se enumera aquí desaparece, y una pregunta sin peso
    // deja de pesar lo que RH le puso. El default de 1 es la media simple de siempre.
    peso: normalizePeso(pregunta?.peso),
    // Se preserva por el mismo motivo que bloqueId: si se cae aquí, el editor deja de ver
    // las respuestas viejas de esta pregunta y ofrece borrarla como si nadie la hubiera
    // contestado. La base lo impediría igual, pero después de haberlo prometido.
    legacyId: pregunta?.legacyId ?? null,
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
    .sort((a, b) => a.orden - b.orden);

export const getPreguntasActivas = (preguntas = []) =>
  normalizePreguntasList(preguntas).filter((p) => p.activa !== false);

export const preguntaToRow = (pregunta) => {
  const base = {
    id: pregunta.id,
    texto: pregunta.texto,
    tipo: pregunta.tipo,
    area: pregunta.area || "General",
    orden: pregunta.orden ?? pregunta.id,
    activa: pregunta.activa !== false,
    bloque_id: pregunta.bloqueId ?? null,
    peso: normalizePeso(pregunta.peso),
  };

  if (pregunta.tipo === "opcion") {
    base.opciones =
      Array.isArray(pregunta.opciones) && pregunta.opciones.length
        ? pregunta.opciones
        : [...DEFAULT_OPCIONES_RIESGO];
  }

  return base;
};
