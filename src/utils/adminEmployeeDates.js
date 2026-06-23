/**
 * Fechas canónicas de empleados administrativos (Oficina Administrativa).
 * Fuente de verdad por NOMBRE — no por id de array.
 */
export const ADMIN_EMPLOYEE_FECHAS = [
  { name: "ANA KAREN MEZA GONZALEZ", fechaIngreso: "2025-10-01", fechaCumpleanos: "08-25" },
  { name: "NOEMI TAMAR HERNANDEZ REYES", fechaIngreso: "2018-08-01", fechaCumpleanos: "01-08" },
  { name: "ELIZABETH MARTINEZ FERRETIZ", fechaIngreso: "2022-02-12", fechaCumpleanos: "09-28" },
  { name: "MARIA CONCEPCION ANDRADE GARCIA", fechaIngreso: "2019-02-05", fechaCumpleanos: "05-13" },
  { name: "JESUS ARMANDO BAUTISTA DEL ANGEL", fechaIngreso: "2024-01-12", fechaCumpleanos: "08-06" },
  { name: "MARIA COVARRUVIAS TORRES", fechaIngreso: "2024-01-20", fechaCumpleanos: "10-02" },
  { name: "ANA ROSA GOMEZ PEREZ", fechaIngreso: "2014-03-30", fechaCumpleanos: "12-04" },
  { name: "MINERVA GEORGINA SANCHEZ SILVA", fechaIngreso: "2025-02-03", fechaCumpleanos: "10-05" },
  { name: "SAMANTA PEREZ CARREÑO", fechaIngreso: "2025-12-03", fechaCumpleanos: "07-20" },
  { name: "ALEXIS ALAN RAFAEL CASTAN", fechaIngreso: "2026-02-23", fechaCumpleanos: "02-16" },
  { name: "ALFREDO EDUARDO BURGOS REYES", fechaIngreso: "2026-05-26", fechaCumpleanos: "09-05" },
  { name: "FRIDA VIRIDIANA MOGOLLON TELLEZ", fechaIngreso: "2025-11-27", fechaCumpleanos: "03-27" },
  { name: "LIC. ANA GORETTY SALAS", fechaIngreso: "2026-03-30", fechaCumpleanos: "07-15" },
  { name: "MARICRUZ IZAGUIRRE OLLERVIDES", fechaIngreso: "2024-09-01", fechaCumpleanos: "05-03" },
];

export const normalizeEmployeeNameKey = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^LIC\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

const ADMIN_FECHAS_BY_NAME = Object.fromEntries(
  ADMIN_EMPLOYEE_FECHAS.map((entry) => [normalizeEmployeeNameKey(entry.name), entry])
);

export const getCanonicalAdminFechas = (name) => {
  const key = normalizeEmployeeNameKey(name);
  return ADMIN_FECHAS_BY_NAME[key] || null;
};

/** Aplica fechas canónicas a un usuario si coincide por nombre. */
export const applyCanonicalAdminDates = (user) => {
  const canonical = getCanonicalAdminFechas(user?.name);
  if (!canonical) return user;
  return {
    ...user,
    fechaIngreso: canonical.fechaIngreso,
    fechaCumpleanos: canonical.fechaCumpleanos,
  };
};

/** Validación temporal: avisa en consola si hay cumpleaños duplicados entre administrativos. */
export const auditAdministrativeFechas = () => {
  const byBirthday = {};
  for (const entry of ADMIN_EMPLOYEE_FECHAS) {
    const key = entry.fechaCumpleanos;
    if (!byBirthday[key]) byBirthday[key] = [];
    byBirthday[key].push(entry.name);
  }
  const duplicates = Object.entries(byBirthday).filter(([, names]) => names.length > 1);
  if (duplicates.length > 0) {
    console.warn(
      "[McDental] Fechas administrativas sospechosas — cumpleaños duplicados:",
      duplicates.map(([fecha, names]) => ({ fechaCumpleanos: fecha, empleados: names }))
    );
  }
};

if (import.meta.env?.DEV) {
  auditAdministrativeFechas();
}
