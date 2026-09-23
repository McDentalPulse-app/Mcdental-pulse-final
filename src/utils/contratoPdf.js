import { jsPDF } from "jspdf";
import { ETIQUETA_TIPO_CONTRATO, clausulasContrato, campo, formatFechaLarga, domicilioTrabajador } from "./contrato";

const MARGEN = 20;
const ANCHO_HOJA = 216; // carta, mm
const ALTO_HOJA = 279;
const ANCHO_TEXTO = ANCHO_HOJA - MARGEN * 2;
const LIMITE_INFERIOR = ALTO_HOJA - 25;

/**
 * Genera el PDF del contrato a partir de los mismos `datos` y las mismas `clausulasContrato()`
 * que pinta la vista previa en pantalla (GenerarContratoModal.jsx) — un solo lugar decide el
 * TEXTO, este archivo solo decide el LAYOUT del papel. Devuelve un Blob, listo para subir al
 * storage o abrir en una pestaña.
 */
export const generarPdfContrato = (datos) => {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  let y = MARGEN;

  const saltoDePaginaSiHaceFalta = (alturaNecesaria) => {
    if (y + alturaNecesaria > LIMITE_INFERIOR) {
      doc.addPage();
      y = MARGEN;
    }
  };

  const parrafo = (texto, { size = 10, style = "normal", gap = 5, align = "justify" } = {}) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lineas = doc.splitTextToSize(texto, ANCHO_TEXTO);
    for (const linea of lineas) {
      saltoDePaginaSiHaceFalta(6);
      doc.text(linea, MARGEN, y, { align: align === "justify" ? "left" : align, maxWidth: ANCHO_TEXTO });
      y += 5;
    }
    y += gap;
  };

  const titulo = (texto) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(texto, ANCHO_HOJA / 2, y, { align: "center" });
    y += 8;
  };

  // ── Encabezado ──────────────────────────────────────────────────────────
  titulo("CONTRATO INDIVIDUAL DE TRABAJO");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(ETIQUETA_TIPO_CONTRATO[datos.tipoContrato].toUpperCase(), ANCHO_HOJA / 2, y, { align: "center" });
  y += 10;

  // ── Comparecencia ───────────────────────────────────────────────────────
  parrafo(
    `Contrato individual de trabajo que celebran, por una parte ${campo(datos.razonSocialPatron)}, ` +
      `representada en este acto por ${campo(datos.representantePatron)}, a quien en lo sucesivo se le ` +
      `denominará "EL PATRÓN"; y por la otra parte el(la) C. ${campo(datos.nombreTrabajador)}, a quien en lo ` +
      `sucesivo se le denominará "EL TRABAJADOR", quienes convienen en sujetarse al tenor de las siguientes ` +
      `declaraciones y cláusulas:`
  );

  // ── Declaraciones ───────────────────────────────────────────────────────
  parrafo("DECLARACIONES", { style: "bold", align: "left", gap: 2 });
  parrafo(
    `I. Declara "EL PATRÓN", por conducto de su representante, tener su domicilio en ` +
      `${campo(datos.domicilioPatron)}, y que requiere de los servicios de "EL TRABAJADOR" para el desempeño ` +
      `del puesto que se señala en la cláusula PRIMERA.`
  );
  parrafo(
    `II. Declara "EL TRABAJADOR" llamarse como ha quedado escrito, de nacionalidad ${campo(datos.nacionalidad)}, ` +
      `nacido el ${formatFechaLarga(datos.fechaNacimiento)}, de sexo ${campo(datos.sexo)}, estado civil ` +
      `${campo(datos.estadoCivil)}, con CURP ${campo(datos.curp)}, RFC ${campo(datos.rfc)}, y con domicilio en ` +
      `${domicilioTrabajador(datos)}; que cuenta con la capacidad y los conocimientos necesarios para prestar ` +
      `sus servicios en el puesto materia de este contrato, y que es su voluntad obligarse en los términos del ` +
      `mismo.`
  );

  // ── Cláusulas ───────────────────────────────────────────────────────────
  parrafo("CLÁUSULAS", { style: "bold", align: "left", gap: 2 });
  for (const clausula of clausulasContrato(datos)) {
    saltoDePaginaSiHaceFalta(12);
    parrafo(clausula.titulo, { style: "bold", gap: 1 });
    parrafo(clausula.texto);
  }

  // ── Cierre y firmas ─────────────────────────────────────────────────────
  parrafo(
    `Leído que fue el presente contrato y enteradas las partes de su contenido y alcance legal, lo firman de ` +
      `conformidad en ${campo(datos.sucursal)}, a ${formatFechaLarga(datos.fechaContrato)}.`
  );

  saltoDePaginaSiHaceFalta(40);
  y += 15;
  const mitad = ANCHO_HOJA / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.line(MARGEN, y, MARGEN + 60, y);
  doc.line(mitad + 10, y, mitad + 70, y);
  y += 5;
  doc.text('"EL PATRÓN"', MARGEN + 30, y, { align: "center" });
  doc.text('"EL TRABAJADOR"', mitad + 40, y, { align: "center" });
  y += 5;
  doc.text(campo(datos.representantePatron), MARGEN + 30, y, { align: "center" });
  doc.text(campo(datos.nombreTrabajador), mitad + 40, y, { align: "center" });

  return doc.output("blob");
};
