export const SUCURSALES = ["Oficina Administrativa", "McDental Palmas", "McDental Madero", "McDental Tampico", "McDental Tampico Obregon", "Popular Tampico", "McDental Tuxpan", "Popular Tuxpan", "McDental Poza Rica", "Popular Poza Rica", "McDental Valles", "McDental Irapuato", "Popular Irapuato", "McDental Victoria", "McDental Reynosa", "McDental Pachuca", "McDental Hermosillo", "McDental Villahermosa", "McDental Huejutla", "McDental Altamira", "McDental Ebano", "Popular Reynosa", "McDental Mante", "McDental Leon", "Martinez De La Torre"];

const SUCURSAL_ALIASES = {
  "Oficina Central": "Oficina Administrativa",
  Central: "Oficina Administrativa",
};

/** Nombre canónico para mostrar (compatibilidad con datos legacy). */
export const normalizeSucursal = (sucursal) => {
  if (!sucursal) return sucursal || "";
  return SUCURSAL_ALIASES[sucursal] || sucursal;
};

/** Comparar sucursales tratando alias legacy como la misma. */
export const sucursalMatches = (a, b) => normalizeSucursal(a) === normalizeSucursal(b);

/** Semana oficial de lanzamiento de McDental Pulse. */
export const OFFICIAL_WEEK = "2026-W01";

/** Semana legacy del piloto; se trata como OFFICIAL_WEEK en lectura y cálculos. */
export const LEGACY_LAUNCH_WEEK = "2025-W15";

/** Semana activa del sistema (encuestas nuevas, badges, KPIs de la semana). */
export const semanaActual = OFFICIAL_WEEK;

/** Normaliza semana guardada (legacy → oficial) sin modificar Firestore. */
export const normalizeWeek = (week) => {
  if (week == null || String(week).trim() === "") return OFFICIAL_WEEK;
  if (week === LEGACY_LAUNCH_WEEK) return OFFICIAL_WEEK;
  return week;
};

/** ¿La encuesta pertenece a la semana activa del sistema? */
export const isSemanaActual = (week) => normalizeWeek(week) === OFFICIAL_WEEK;

/** Semana para mostrar en UI (badges, modales, historial). */
export const formatSemanaDisplay = (week) => normalizeWeek(week);