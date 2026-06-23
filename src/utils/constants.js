export const SUCURSALES = ["Norte", "Central", "Oficina Administrativa", "McDental Palmas", "McDental Madero", "McDental Tampico", "McDental Tampico Obregon", "Popular Tampico", "McDental Tuxpan", "Popular Tuxpan", "McDental Poza Rica", "Popular Poza Rica", "McDental Valles", "McDental Irapuato", "Popular Irapuato", "McDental Victoria", "McDental Reynosa", "McDental Pachuca", "McDental Hermosillo", "McDental Villahermosa", "McDental Huejutla", "McDental Altamira", "McDental Ebano", "Popular Reynosa", "McDental Mante", "McDental Leon", "Martinez De La Torre"];

const SUCURSAL_ALIASES = {
  "Oficina Central": "Oficina Administrativa",
};

/** Nombre canónico para mostrar (compatibilidad con datos legacy). */
export const normalizeSucursal = (sucursal) => {
  if (!sucursal) return sucursal || "";
  return SUCURSAL_ALIASES[sucursal] || sucursal;
};

/** Comparar sucursales tratando alias legacy como la misma. */
export const sucursalMatches = (a, b) => normalizeSucursal(a) === normalizeSucursal(b);

export const semanaActual = "2025-W15";