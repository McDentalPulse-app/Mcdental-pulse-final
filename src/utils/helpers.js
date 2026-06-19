export const calcularAntiguedad = (fechaIngreso) => {
  if (!fechaIngreso) return "Sin fecha de ingreso";

  const inicio = new Date(fechaIngreso);
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
