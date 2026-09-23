import { describe, it, expect } from "vitest";
import { generarPdfContrato } from "./contratoPdf";
import { datosContratoIniciales, TIPOS_CONTRATO } from "./contrato";

describe("generarPdfContrato", () => {
  it("genera un Blob de PDF sin datos capturados (todo en rayas), sin reventar", () => {
    const blob = generarPdfContrato(datosContratoIniciales());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("genera el PDF con datos completos para los tres tipos de contrato", () => {
    const base = {
      ...datosContratoIniciales({ name: "Ana Puntual", puesto: "Recepción", sucursal: "palmas", fechaIngreso: "2024-01-10", sueldoSemanal: 2100 }),
      razonSocialPatron: "McDental S.A. de C.V.",
      domicilioPatron: "Av. Siempre Viva 123, Monterrey, NL",
      representantePatron: "Juan Pérez",
      curp: "PUAA000101HNLXXX01",
      rfc: "PUAA000101ABC",
      fechaNacimiento: "2000-01-01",
      sexo: "Mujer",
      estadoCivil: "Soltera",
      domicilioCalleNumero: "Calle 1 #23",
      domicilioColonia: "Centro",
      domicilioCP: "64000",
      domicilioCiudad: "Monterrey",
      domicilioEstado: "Nuevo León",
    };

    for (const tipoContrato of Object.values(TIPOS_CONTRATO)) {
      const datos = { ...base, tipoContrato, fechaTermino: "2026-12-31", descripcionObra: "Remodelación" };
      const blob = generarPdfContrato(datos);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    }
  });
});
