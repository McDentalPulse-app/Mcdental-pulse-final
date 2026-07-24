// Catálogo de medallas de Reconocimientos. Cada categoría es una medalla con su propio ícono y
// color de identidad (los `--mc-evento-*` son colores categóricos fijos, iguales en claro y
// oscuro — como los colores de evento del calendario). El dato guardado sigue siendo `categoria`;
// esto es solo cómo se pinta. Íconos ya mapeados en components/ui/Icon.jsx.
export const MEDALLAS = {
  "Excelente actitud":   { icono: "star",      color: "var(--mc-evento-azul)" },
  "Liderazgo":           { icono: "award",     color: "var(--mc-evento-ambar)" },
  "Trabajo en equipo":   { icono: "users",     color: "var(--mc-evento-verde)" },
  "Innovación":          { icono: "lightbulb", color: "var(--mc-evento-morado)" },
  "Atención al paciente":{ icono: "heart",     color: "var(--mc-evento-rosa)" },
  "Puntualidad":         { icono: "clock",     color: "var(--mc-evento-aqua)" },
  "Valores McDental":    { icono: "shield",    color: "var(--mc-evento-rojo)" },
};

// Medalla por defecto para categorías legacy o desconocidas: nunca se rompe la vista.
const MEDALLA_DEFAULT = { icono: "award", color: "var(--mc-evento-gris)" };

/** Devuelve el ícono + color de la medalla de una categoría (con fallback seguro). */
export const getMedalla = (categoria) => MEDALLAS[categoria] || MEDALLA_DEFAULT;

/** Lista de categorías disponibles, para el select de RH (una sola fuente de verdad). */
export const CATEGORIAS_MEDALLA = Object.keys(MEDALLAS);
