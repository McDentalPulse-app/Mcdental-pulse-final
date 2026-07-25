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

/** Semana legacy del piloto; se trata como la semana activa en lectura. */
export const LEGACY_LAUNCH_WEEK = "2025-W15";

/**
 * Semana ISO-8601 ("YYYY-Www") de una fecha. Las semanas empiezan el LUNES;
 * el corte es la medianoche local del lunes (00:00). Calcula sobre la fecha
 * local, así la encuesta se reinicia cada lunes a las 12 am hora local.
 */
export const getISOWeek = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // lunes=1 … domingo=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // jueves de esta semana ISO
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

/** Semana activa del sistema (clave interna ISO; encuestas nuevas, KPIs, reinicio).
 *  Live binding: refreshSemana() lo actualiza al cruzar el lunes, sin recargar. */
export let semanaActual = getISOWeek();

/** Semana ISO del lanzamiento real (primera semana en que se aplican encuestas) = W1.
 *  Fija: la próxima semana será W2, y así sucesivamente. */
export const LAUNCH_WEEK = "2026-W27";

/** Lunes (UTC) de una semana ISO "YYYY-Www". */
const isoWeekToMonday = (week) => {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(week ?? "").trim());
  if (!m) return null;
  const [, year, wk] = m;
  const simple = new Date(Date.UTC(Number(year), 0, 1 + (Number(wk) - 1) * 7));
  const dow = simple.getUTCDay() || 7;
  simple.setUTCDate(simple.getUTCDate() - dow + 1);
  return simple;
};

/** Número de semana relativo al lanzamiento (W1, W2, …). null si es anterior. */
export const semanaNumero = (week) => {
  const a = isoWeekToMonday(week);
  const b = isoWeekToMonday(LAUNCH_WEEK);
  if (!a || !b) return null;
  const n = Math.round((a - b) / (7 * 86400000)) + 1;
  return n >= 1 ? n : null;
};

/** Normaliza semana guardada: solo rellena vacías con la activa. Conserva la
 *  semana real (incluida la legacy del piloto) para no falsear el orden/historial. */
export const normalizeWeek = (week) => {
  if (week == null || String(week).trim() === "") return semanaActual;
  return week;
};

/**
 * ¿La encuesta pertenece a la semana activa? Compara la semana exacta tagueada
 * al enviar (no remapea legacy/vacías), para que solo cuente la encuesta real
 * de esta semana y el reinicio del lunes funcione.
 */
export const isSemanaActual = (week) => String(week ?? "").trim() === getISOWeek();

/** Año del lanzamiento, prefijo de las etiquetas ("2026-W1", "2026-W2", …). */
const LAUNCH_YEAR = LAUNCH_WEEK.slice(0, 4);

/** Semana para mostrar en UI: del lanzamiento en adelante numera "2026-W01",
 *  "2026-W02", … Todas las semanas anteriores al lanzamiento (legacy 2025 y
 *  pilotos 2026 previos) se juntan bajo una sola etiqueta "2026-W00". */
export const formatSemanaDisplay = (week) => {
  const w = normalizeWeek(week);
  const n = semanaNumero(w);
  return n ? `${LAUNCH_YEAR}-W${String(n).padStart(2, "0")}` : `${LAUNCH_YEAR}-W00`;
};

/** Etiqueta de la semana activa para encabezados ("2026-W01", …). Live binding. */
export let semanaDisplay = formatSemanaDisplay(semanaActual);

/** Recalcula la semana activa. Si cambió (cruzó el lunes), actualiza los live
 *  bindings y devuelve true. Lo invoca un timer en App para refrescar sin recargar. */
export const refreshSemana = () => {
  const w = getISOWeek();
  if (w === semanaActual) return false;
  semanaActual = w;
  semanaDisplay = formatSemanaDisplay(w);
  return true;
};