import { jsPDF } from "jspdf";
import { money } from "./nomina";
import { ESTADOS_DIA } from "./asistencia";

const MARGEN = 20;
const ANCHO_HOJA = 216; // carta, mm
const ANCHO_TEXTO = ANCHO_HOJA - MARGEN * 2;

const formatFecha = (iso) => {
  if (!iso) return "—";
  // Ancla a mediodía: mismo motivo que AcuerdoConformidad.jsx (una fecha "YYYY-MM-DD" se
  // interpreta como medianoche UTC y en un huso detrás de UTC el día se corre uno hacia atrás).
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
};

const TEXTO_CONFORMIDAD =
  "Por medio del presente declaro haber recibido de conformidad la cantidad señalada, por " +
  "concepto de pago de sueldo del periodo indicado, manifestando estar de acuerdo con el " +
  "monto, los conceptos y las deducciones aplicadas, sin tener nada que reclamar por este " +
  "concepto.";

/**
 * Genera el PDF del recibo de conformidad de pago de UNA persona — mismo contenido y mismos
 * números que AcuerdoConformidad.jsx (la vista de `window.print()`), solo que como archivo
 * descargable directo, para quien prefiere guardar el PDF en vez de abrir el diálogo de
 * impresión del navegador. Devuelve un Blob.
 */
export const generarPdfAcuerdo = ({ empleado, recibo, desde, hasta }) => {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  let y = MARGEN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("McDental Pulse", ANCHO_HOJA / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.text("Recibo de conformidad de pago", ANCHO_HOJA / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Periodo del ${formatFecha(desde)} al ${formatFecha(hasta)}`, ANCHO_HOJA / 2, y, { align: "center" });
  y += 12;

  const fila = (etiqueta, valor) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(etiqueta, MARGEN, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(valor), MARGEN + 45, y);
    y += 7;
  };

  fila("Nombre", empleado.name || "—");
  fila("Puesto", empleado.puesto || "—");
  fila("Sucursal", empleado.sucursal || "—");
  y += 5;

  // Mismo desglose que AcuerdoConformidad.jsx: los montos de retardos/faltas se sacan del
  // `detalle` ya calculado (no se recalculan aquí), para no poder decir un número distinto.
  const montoRetardos = recibo.detalle
    .filter((d) => d.estado === ESTADOS_DIA.RETARDO)
    .reduce((suma, d) => suma + d.descuento, 0);
  const montoFaltas = recibo.descuento - montoRetardos;

  doc.setDrawColor(150);
  doc.line(MARGEN, y, ANCHO_HOJA - MARGEN, y);
  y += 7;

  const filaMonto = (etiqueta, valor, { negrita = false } = {}) => {
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.setFontSize(10);
    doc.text(etiqueta, MARGEN, y);
    doc.text(valor, ANCHO_HOJA - MARGEN, y, { align: "right" });
    y += 7;
  };

  filaMonto("Sueldo semanal", recibo.sinSueldo ? "Sin capturar" : money(recibo.sueldo));
  filaMonto(`Descuento por retardos (${recibo.retardos})`, montoRetardos > 0 ? `− ${money(montoRetardos)}` : money(0));
  filaMonto(`Descuento por faltas (${recibo.faltas})`, montoFaltas > 0 ? `− ${money(montoFaltas)}` : money(0));
  doc.line(MARGEN, y - 2, ANCHO_HOJA - MARGEN, y - 2);
  filaMonto("Pago neto", recibo.sinSueldo ? "Sin capturar" : money(recibo.pagoFinal), { negrita: true });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lineas = doc.splitTextToSize(TEXTO_CONFORMIDAD, ANCHO_TEXTO);
  for (const linea of lineas) {
    doc.text(linea, MARGEN, y);
    y += 5;
  }

  y += 20;
  const mitad = ANCHO_HOJA / 2;
  doc.line(MARGEN, y, MARGEN + 65, y);
  doc.line(mitad + 15, y, mitad + 65, y);
  y += 5;
  doc.setFontSize(8);
  doc.text("Nombre y firma del trabajador", MARGEN + 32, y, { align: "center" });
  doc.text("Huella digital", mitad + 40, y, { align: "center" });

  return doc.output("blob");
};
