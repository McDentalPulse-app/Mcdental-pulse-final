/**
 * Catálogo de causas de permiso. Debe coincidir con la constraint permisos_causa_valida
 * de la migración 038: si aquí se añade una causa que la base no acepta, el insert falla
 * con un error de constraint que no le dice nada al usuario.
 *
 * La causa se acota a este catálogo (y el texto libre va en `comentario`) porque "cita
 * médica", "cita al doctor" y "medico" son la misma cosa escrita de tres formas, y
 * ningún reporte puede contarlas juntas.
 */
export const CAUSA_SALIDA_ANTICIPADA = "salida_anticipada";

export const CAUSAS_PERMISO = [
  { valor: CAUSA_SALIDA_ANTICIPADA, label: "Salida anticipada (irme antes hoy)", pideHora: true },
  { valor: "enfermedad", label: "Enfermedad" },
  { valor: "cita_medica", label: "Cita médica" },
  { valor: "asunto_personal", label: "Asunto personal" },
  { valor: "luto", label: "Fallecimiento de un familiar" },
  { valor: "tramite_oficial", label: "Trámite oficial" },
  { valor: "otro", label: "Otro" },
];

export const ETIQUETA_CAUSA = Object.fromEntries(
  CAUSAS_PERMISO.map(({ valor, label }) => [valor, label])
);
