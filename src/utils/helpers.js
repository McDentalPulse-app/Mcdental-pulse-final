export const calcularAntiguedad = (fechaIngreso) => {
  if (!fechaIngreso) return "No registrada";

  const inicio = new Date(fechaIngreso);
  if (Number.isNaN(inicio.getTime())) return "No registrada";

  const hoy = new Date();

  let años = hoy.getFullYear() - inicio.getFullYear();
  let meses = hoy.getMonth() - inicio.getMonth();

  if (hoy.getDate() < inicio.getDate()) {
    meses--;
  }

  if (meses < 0) {
    años--;
    meses += 12;
  }

  let str = "";
  if (años > 0) str += `${años} año${años > 1 ? "s" : ""} `;
  if (meses > 0) str += `${meses} mes${meses > 1 ? "es" : ""}`;

  return str.trim() || "Menos de 1 mes";
};

/**
 * Fecha de ingreso (YYYY-MM-DD).
 *
 * Antes existía un override por nombre para los 14 administrativos, que se aplicaba
 * POR ENCIMA de la base. Se eliminó: eran datos personales viviendo en el código, y
 * además tapaba el hecho de que esas fechas nunca se habían guardado en la base.
 * Ya están sincronizadas en `usuarios.fecha_ingreso`, que es ahora la única fuente.
 */
export const resolveFechaIngreso = (user) => user?.fechaIngreso || "";

/**
 * Cumpleaños (MM-DD).
 *
 * Se conserva el fallback a `fechaNacimiento` (fecha completa del dataset legacy de
 * Firestore) para los usuarios que aún no tengan `fechaCumpleanos` poblado.
 */
export const resolveFechaCumpleanos = (user) => {
  const explicit = user?.fechaCumpleanos;
  if (explicit != null && String(explicit).trim() !== "") {
    return String(explicit).trim();
  }

  const legacy = user?.fechaNacimiento;
  if (!legacy) return "";
  if (/^\d{2}-\d{2}$/.test(legacy)) return legacy;
  const parts = String(legacy).split("-");
  if (parts.length >= 3) return `${parts[1]}-${parts[2]}`;
  return "";
};

/** Antigüedad legible para un empleado; usa resolveFechaIngreso (incluye administrativos). */
export const formatAntiguedadEmpleado = (user) => {
  const fecha = resolveFechaIngreso(user);
  if (!fecha) return "Sin fecha de ingreso";
  return calcularAntiguedad(fecha);
};

/**
 * Fecha en que se PIDIÓ una solicitud (permiso o vacaciones), para el expediente.
 *
 * Ojo con la diferencia: `fecha`/`fechaInicio` es el día que la persona quiere librar, y
 * `createdAt` el día que lo solicitó. En el historial hacen falta las dos — "pidió el 3
 * un permiso para el 20" no es lo mismo que "lo pidió el 19".
 *
 * A diferencia de formatFechaIngreso, aquí NO se ancla a mediodía: `created_at` ya es un
 * timestamp con zona horaria, no una fecha suelta que el navegador pueda correr un día.
 */
export const formatFechaSolicitud = (createdAt) => {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatFechaIngreso = (fechaIngreso) => {
  if (!fechaIngreso) return "No registrada";
  const date = new Date(`${fechaIngreso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "No registrada";
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const formatFechaCumpleanos = (fechaCumpleanos) => {
  if (!fechaCumpleanos) return "No registrada";
  if (/^\d{2}-\d{2}$/.test(fechaCumpleanos)) {
    const [month, day] = fechaCumpleanos.split("-").map(Number);
    const date = new Date(2000, month - 1, day);
    if (Number.isNaN(date.getTime())) return "No registrada";
    return date.toLocaleDateString("es-MX", { day: "2-digit", month: "long" });
  }
  const date = new Date(fechaCumpleanos);
  if (Number.isNaN(date.getTime())) return "No registrada";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "long" });
};

export const daysUntilDate = (dateString) => {
  if (!dateString) return 999;
  const original = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(original.getTime())) return 999;

  const today = new Date();
  const currentYear = today.getFullYear();
  let next = new Date(currentYear, original.getMonth(), original.getDate());
  const todayStart = new Date(currentYear, today.getMonth(), today.getDate());
  if (next < todayStart) {
    next = new Date(currentYear + 1, original.getMonth(), original.getDate());
  }
  const diff = next - todayStart;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const daysUntilCumpleanos = (fechaCumpleanos) => {
  if (!fechaCumpleanos) return 999;
  if (/^\d{2}-\d{2}$/.test(fechaCumpleanos)) {
    const [month, day] = fechaCumpleanos.split("-").map(Number);
    const today = new Date();
    const currentYear = today.getFullYear();
    let next = new Date(currentYear, month - 1, day);
    const todayStart = new Date(currentYear, today.getMonth(), today.getDate());
    if (next < todayStart) {
      next = new Date(currentYear + 1, month - 1, day);
    }
    const diff = next - todayStart;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
  return daysUntilDate(fechaCumpleanos);
};

export const yearsSinceIngreso = (fechaIngreso) => {
  if (!fechaIngreso) return 0;
  const date = new Date(`${fechaIngreso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  return new Date().getFullYear() - date.getFullYear();
};

export const normalizeFechaCumpleanosInput = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}-${match[3]}`;
  return trimmed;
};

const MAX_SHORT_EMPLEADO_ID = 9999;

export const isShortEmpleadoId = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && Number.isInteger(num) && num > 0 && num <= MAX_SHORT_EMPLEADO_ID;
};

/** ID numérico corto del empleado (idOriginal o id). Ignora timestamps. */
export const getEmpleadoNumericId = (user) => {
  if (!user) return null;
  for (const candidate of [user.idOriginal, user.id]) {
    if (isShortEmpleadoId(candidate)) return Number(candidate);
  }
  return null;
};

export const formatEmpleadoIdForDisplay = (user) => {
  const shortId = getEmpleadoNumericId(user);
  if (shortId !== null) return String(shortId);
  if (user?.id != null && user.id !== "") {
    return String(user.id);
  }
  return "Sin ID";
};

/** Roles que forman la plantilla (los que "son personal"), frente a los de
 *  gestión (admin/rh/psicologa), que no se cuentan como plantilla. */
export const ROLES_PLANTILLA = ["empleado", "doctor"];

/** Empleado activo: la plantilla operativa. Los inactivos (baja) se excluyen
 *  de dashboards, KPIs, encuestas, mensajes y selects de acción — pero se
 *  conservan en Expedientes y Gestión de Personal (historial/reactivación).
 *
 *  `doctor` cuenta como empleado: es un empleado con extras (comisiones), no
 *  una categoría aparte. Al crearse el rol se quedó fuera de este filtro y eso
 *  borraba a 54 de las 99 personas de la plantilla en las 10 pantallas que lo
 *  usan (listas, dashboards, reportes RH, reconocimientos, descuentos,
 *  mensajes y AI Engine). */
export const esEmpleadoActivo = (u) => ROLES_PLANTILLA.includes(u?.role) && !u?.inactivo;

/**
 * Una fecha suelta ("2026-08-20") en corto y legible: "20 ago 2026".
 *
 * Se ancla a MEDIODÍA, igual que formatFechaIngreso: una fecha sin hora la interpreta el
 * navegador como medianoche UTC, y en México eso cae en el día ANTERIOR. Sin el ancla, unas
 * vacaciones del 20 al 24 se muestran del 19 al 23.
 */
export const formatFechaCorta = (fecha) => {
  if (!fecha) return "";
  const date = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

/**
 * Un rango de fechas dicho como lo diría una persona.
 *
 * Si empieza y acaba el mismo día, no se repite: "20 ago 2026" y no "20 ago 2026 al 20 ago
 * 2026".
 *
 * SIN FECHA FIN ES UN SOLO DÍA, no un rango abierto. En permisos, `fecha_fin` nulo significa
 * exactamente eso (migración 038), así que decir "Desde el 10 de agosto" sería afirmar que el
 * permiso sigue abierto — que es falso y además preocupante para quien lo lea. Se muestra el
 * día y ya.
 *
 * Y nunca se devuelve un "al" suelto sin fechas alrededor, que es lo que se veía en la pantalla
 * de vacaciones cuando leía un campo que no existía.
 */
export const formatRangoFechas = (inicio, fin) => {
  const a = formatFechaCorta(inicio);
  const b = formatFechaCorta(fin);
  if (a && b) return a === b ? a : `${a} al ${b}`;
  if (a) return a;
  if (b) return b;
  return "Sin fechas";
};
