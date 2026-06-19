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