import { normalizeSucursal, sucursalMatches } from "./constants";

/**
 * Búsqueda del Expediente Integral. Vive fuera del componente para poder probarla sin montar
 * React (el proyecto no tiene testing-library, sus tests son de funciones puras).
 */

/**
 * Sin acentos y en minúsculas: media plantilla se apellida López o Martínez, y nadie escribe
 * el acento en un buscador. Sin esto, teclear "lopez" no encontraría a "López".
 */
export const normalizarTexto = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Filtra por sucursal y por texto libre (nombre, puesto o sucursal). Las dos condiciones se
 * suman: buscar dentro de una sucursal concreta sigue respetando la sucursal.
 */
export const filtrarEmpleadosExpediente = (empleados = [], { sucursal = "Todas", busqueda = "" } = {}) => {
  const termino = normalizarTexto(busqueda);

  return empleados.filter((emp) => {
    if (sucursal !== "Todas" && !sucursalMatches(emp.sucursal, sucursal)) return false;
    if (!termino) return true;

    return [emp.name, emp.puesto, normalizeSucursal(emp.sucursal)]
      .some((campo) => normalizarTexto(campo).includes(termino));
  });
};

/**
 * El expediente incluye a quien ya no trabaja aquí (es archivo histórico), así que el estatus
 * hay que leerlo de la fila, no darlo por hecho. Mismo criterio que Gestión de Usuarios, para
 * que las dos pantallas no se contradigan sobre la misma persona.
 */
export const estatusEmpleado = (empleado) => {
  if (empleado?.archivado) return { texto: "Archivado", variante: "rechazado" };
  if (empleado?.inactivo) return { texto: "Inactivo", variante: "inactivo" };
  return { texto: "Activo", variante: "activo" };
};
