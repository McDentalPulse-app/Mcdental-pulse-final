/**
 * Normalización del nombre de un empleado, para comparar sin que estorben las tildes,
 * el prefijo "LIC." o los espacios de más.
 *
 * Este módulo contenía además una tabla `ADMIN_EMPLOYEE_FECHAS` con el nombre real, la
 * fecha de ingreso y el cumpleaños de 14 empleados administrativos, que se aplicaba como
 * override por encima de la base de datos. Se eliminó por dos motivos:
 *
 *   1. Eran datos personales dentro del código, y el código acaba en el bundle público.
 *   2. Era un override: `resolveFechaIngreso` prefería el hardcode antes que
 *      `usuarios.fecha_ingreso`, así que la base podía estar mal y nadie se enteraba.
 *      De hecho lo estaba — esas fechas nunca llegaron a la base, y el hardcode lo tapaba.
 *
 * Las fechas se sincronizaron a `public.usuarios` (verificado: 12/12 coinciden) y la
 * fuente de verdad es ahora la base, sin excepciones.
 */
export const normalizeEmployeeNameKey = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^LIC\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
