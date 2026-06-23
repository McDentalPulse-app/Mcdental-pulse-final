import { getCanonicalAdminFechas } from "./adminEmployeeDates";

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

/** Fecha de ingreso canónica (YYYY-MM-DD). Administrativos: por nombre, no por id. */
export const resolveFechaIngreso = (user) => {
  const canonical = getCanonicalAdminFechas(user?.name);
  if (canonical?.fechaIngreso) return canonical.fechaIngreso;
  return user?.fechaIngreso || "";
};

/**
 * Cumpleaños canónico (MM-DD).
 * Administrativos: mapa por nombre. Legacy: fechaNacimiento solo si no hay fechaCumpleanos.
 */
export const resolveFechaCumpleanos = (user) => {
  const canonical = getCanonicalAdminFechas(user?.name);
  if (canonical?.fechaCumpleanos) return canonical.fechaCumpleanos;

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
