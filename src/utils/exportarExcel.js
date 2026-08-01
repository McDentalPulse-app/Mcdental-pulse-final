/**
 * Exportación a Excel de verdad (.xlsx), no un CSV con nombre de Excel.
 *
 * Por qué existe: los cuatro reportes de RH y el de asistencia anunciaban "Excel" y
 * escribían un CSV con TODAS las celdas entrecomilladas. Excel las leía como texto, así que
 * el score, las horas trabajadas y la puntualidad no se podían sumar, promediar ni graficar
 * sin reescribir el archivo columna por columna a mano. Un reporte que hay que rehacer antes
 * de usarlo no es un reporte.
 *
 * Además cada pantalla llevaba su propia copia del escapado y del blob —cinco copias en dos
 * archivos—, así que un arreglo había que hacerlo cinco veces y sin que nadie se acordara.
 *
 * exceljs ya estaba instalado y ya se usaba así en ImportarHorarios: import dinámico, para
 * que su peso no entre en el arranque de la app sino solo cuando alguien exporta.
 */

/**
 * El valor que va a la celda, respetando su tipo.
 *
 * La clave está en las columnas numéricas: los reportes escriben "Sin datos" cuando alguien
 * no ha contestado, y ese texto dentro de una columna de números rompe cualquier fórmula
 * aunque el resto de celdas sean correctas. En Excel la ausencia de dato se escribe con la
 * celda VACÍA (null), que es justo lo que un promedio sabe ignorar.
 */
export const valorDeCelda = (valor, tipo) => {
  if (tipo !== "numero" && tipo !== "decimal") return valor ?? "";
  // Number("") es 0: sin esta guarda una celda sin dato se exportaba como CERO, que en una
  // columna de score o de horas no es "no hay dato" sino un dato falso que baja el promedio.
  if (valor === "" || valor === null || valor === undefined) return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
};

const FORMATO = { decimal: "0.0", numero: "0" };

/**
 * Genera y descarga la hoja.
 *
 * `columnas`: [{ header, key, width, tipo }] — `tipo` es "texto" (por defecto), "numero" o
 * "decimal". `filas`: objetos indexados por `key`.
 */
export const descargarExcel = async ({ nombreArchivo, hoja = "Reporte", columnas, filas }) => {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.created = new Date();
  const ws = libro.addWorksheet(hoja);

  ws.columns = columnas.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(12, c.header.length + 2),
  }));

  for (const fila of filas) {
    const celdas = {};
    for (const c of columnas) celdas[c.key] = valorDeCelda(fila[c.key], c.tipo);
    const agregada = ws.addRow(celdas);
    columnas.forEach((c, i) => {
      if (FORMATO[c.tipo]) agregada.getCell(i + 1).numFmt = FORMATO[c.tipo];
    });
  }

  // Encabezado en negritas y congelado, y autofiltro: es lo que hace que un reporte de 100
  // filas se pueda leer sin perder de vista de qué columna es cada número.
  const encabezado = ws.getRow(1);
  encabezado.font = { bold: true };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F6" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  // Al DOM antes de pulsarlo: un <a> suelto no dispara la descarga en Firefox, que es
  // exactamente lo que le pasaba al export de asistencia.
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
