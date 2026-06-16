// Preguntas de la encuesta
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

// Semana actual para referenciar las encuestas
// Reemplazar por lógica dinámica
export const SEMANA_ACTUAL = "2025-W15";

// Sucursales
export const SUCURSALES = [
  "Norte", "Sur", "Centro", "Central", "Oficina Central",
  "McDental Palmas", "McDental Madero",
  "McDental Tampico", "McDental Tampico Obregon",
  "Popular Tampico",
  "McDental Tuxpan", "Popular Tuxpan",
  "McDental Poza Rica", "Popular Poza Rica",
  "McDental Valles",
  "McDental Irapuato", "Popular Irapuato",
  "McDental Victoria",
  "McDental Reynosa", "Popular Reynosa",
  "McDental Pachuca",
  "McDental Hermosillo",
  "McDental Villahermosa",
  "McDental Huejutla",
  "McDental Altamira",
  "McDental Ebano",
  "McDental Mante",
  "McDental Leon",
  "Martinez De La Torre",
];

// Colores del tema McDental Pulse
export const THEME = {
  verde: "#007A68",
  verdeOscuro: "#003F35",
  verdeMedio: "#006D5B",
  aqua: "#00A88F",
  azul: "#1F3A8A",
  grisFondo: "#F3F7F6",
  grisTexto: "#64748B",
  grisSuave: "#E2E8F0",
  blanco: "#FFFFFF",
  sombra: "0 18px 45px rgba(15, 23, 42, 0.10)",
  sombraSuave: "0 8px 24px rgba(15, 23, 42, 0.08)",
  radio: 22,
};

// Semáforo de bienestar
export const SEMAFORO = {
  color: { verde: "#22c55e", amarillo: "#f59e0b", rojo: "#ef4444" },
  bg: { verde: "#dcfce7", amarillo: "#fef3c7", rojo: "#fee2e2" },
  label: { verde: "Estable", amarillo: "Atención", rojo: "Foco Rojo" },
};

// Roles de usuario
export const ROLES = {
  ADMIN: "admin",
  PSICOLOGA: "psicologa",
  RH: "rh",
  EMPLEADO: "empleado",
};

// Modelo de IA
export const AI_MODEL = "claude-sonnet-4-20250514";
export const AI_ENDPOINT = "https://api.anthropic.com/v1/messages";