import { describe, it, expect } from "vitest";
import { generarPdfAcuerdo } from "./acuerdoConformidadPdf";
import { ESTADOS_DIA } from "./asistencia";

describe("generarPdfAcuerdo", () => {
  const empleado = { name: "Ana Puntual", puesto: "Recepción", sucursal: "McDental Palmas" };

  it("genera un Blob de PDF con un recibo normal", () => {
    const recibo = {
      sueldo: 2100,
      descuento: 300,
      pagoFinal: 1800,
      sinSueldo: false,
      retardos: 1,
      faltas: 1,
      detalle: [
        { estado: ESTADOS_DIA.RETARDO, descuento: 100 },
        { estado: ESTADOS_DIA.FALTA, descuento: 200 },
      ],
    };
    const blob = generarPdfAcuerdo({ empleado, recibo, desde: "2026-09-14", hasta: "2026-09-20" });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("no revienta con sinSueldo, sin retardos ni faltas", () => {
    const recibo = { sueldo: 0, descuento: 0, pagoFinal: 0, sinSueldo: true, retardos: 0, faltas: 0, detalle: [] };
    const blob = generarPdfAcuerdo({ empleado, recibo, desde: "2026-09-14", hasta: "2026-09-20" });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
