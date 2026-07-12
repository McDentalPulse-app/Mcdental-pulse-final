// Datos semilla de la app. El roster de usuarios vivía aquí como fuente de la
// migración a Supabase; se eliminó porque ya no lo consumía nadie y Rollup no
// podía descartarlo por tree-shaking, así que los datos personales de la
// plantilla (nombre, fecha de nacimiento, sucursal, puesto) terminaban servidos
// en el bundle público. La fuente de verdad de usuarios es public.usuarios.

// Estado inicial antes de que resuelva el fetch a Supabase (GlobalContext).
export const MENSAJES_INIT = [];
export const NOTAS_INIT = [];
export const CALENDARIO_EXTRA_INIT = [];
export const REPORTES_CONFIDENCIALES_INIT = [];

// Fallback si encuesta_preguntas viene vacía de la base (GlobalContext).
export const ENCUESTA_PREGUNTAS = [
  { id: 1, texto: "¿Cómo describes tu estado emocional esta semana?", tipo: "escala", area: "Emocional" },
  { id: 2, texto: "¿Qué tan estresado/a te has sentido en el trabajo?", tipo: "escala", area: "Estrés" },
  { id: 3, texto: "¿Qué tan satisfecho/a estás con tu trabajo actualmente?", tipo: "escala", area: "Satisfacción" },
  { id: 4, texto: "¿Cómo es tu relación con tus compañeros esta semana?", tipo: "escala", area: "Relaciones" },
  { id: 5, texto: "¿Cómo es tu relación con tu jefe directo?", tipo: "escala", area: "Liderazgo" },
  { id: 6, texto: "¿Sientes que tu carga de trabajo es manejable?", tipo: "sino", area: "Carga" },
  { id: 7, texto: "¿Tienes algún problema personal que esté afectando tu trabajo?", tipo: "sino", area: "Personal" },
  { id: 8, texto: "¿Qué tan motivado/a te sientes para venir a trabajar?", tipo: "escala", area: "Motivación" },
  { id: 9, texto: "¿Has pensado en renunciar durante esta semana?", tipo: "opcion", opciones: ["No", "Algo", "Sí, seriamente"], area: "Riesgo" },
  { id: 10, texto: "¿Quieres compartir algo más con el equipo de bienestar?", tipo: "abierta", area: "Comentarios" },
];
