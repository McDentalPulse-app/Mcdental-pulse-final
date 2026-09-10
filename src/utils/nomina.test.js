import { describe, it, expect } from "vitest";
import { calcularNomina, descuentoDelDia, DESCUENTOS_DEFECTO, money } from "./nomina";
import { ESTADOS_DIA } from "./asistencia";

const CONFIG = { montoRetardo: 50, montoFalta: 300 };

/** Un día ya clasificado, como los que devuelve construirDias(). */
const dia = (fecha, estado) => ({ fecha, estado, minutosRetardo: 0 });

describe("descuentoDelDia", () => {
  it("cobra el monto del retardo y el de la falta", () => {
    expect(descuentoDelDia(ESTADOS_DIA.RETARDO, CONFIG)).toBe(50);
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, CONFIG)).toBe(300);
  });

  it("no cobra nada por los días que no son ni retardo ni falta", () => {
    for (const estado of [
      ESTADOS_DIA.PRESENTE,
      ESTADOS_DIA.JUSTIFICADO,
      ESTADOS_DIA.DESCANSO,
      ESTADOS_DIA.PENDIENTE,
      ESTADOS_DIA.PRUEBA,
      // "Sin salida" es un caso que RH tiene que mirar, no un descuento automático.
      ESTADOS_DIA.INCOMPLETO,
    ]) {
      expect(descuentoDelDia(estado, CONFIG)).toBe(0);
    }
  });

  it("sin configuración no descuenta nada (mejor eso que inventar un monto)", () => {
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, DESCUENTOS_DEFECTO)).toBe(0);
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, undefined)).toBe(0);
    expect(descuentoDelDia(ESTADOS_DIA.RETARDO, { montoRetardo: null })).toBe(0);
    expect(descuentoDelDia(ESTADOS_DIA.RETARDO, { montoRetardo: "abc" })).toBe(0);
  });
});

describe("calcularNomina", () => {
  it("descuenta cada retardo y cada falta del sueldo semanal", () => {
    const dias = [
      dia("2026-09-07", ESTADOS_DIA.PRESENTE),
      dia("2026-09-08", ESTADOS_DIA.RETARDO),
      dia("2026-09-09", ESTADOS_DIA.RETARDO),
      dia("2026-09-10", ESTADOS_DIA.FALTA),
      dia("2026-09-11", ESTADOS_DIA.PRESENTE),
      dia("2026-09-12", ESTADOS_DIA.DESCANSO),
    ];
    const r = calcularNomina({ dias, sueldoSemanal: 2000, config: CONFIG });

    expect(r.retardos).toBe(2);
    expect(r.faltas).toBe(1);
    expect(r.descuento).toBe(400); // 50 + 50 + 300
    expect(r.pagoFinal).toBe(1600);
    expect(r.sinSueldo).toBe(false);
  });

  it("la falta descuenta SOLO su monto: el día no se resta aparte del sueldo semanal", () => {
    // Decisión del dueño (2026-09-10). Con sueldo 2100 y una falta de 300, el pago es 1800 —
    // NO 1800 menos un séptimo del sueldo. Si esto cambia, cambia el dinero de la gente.
    const dias = [dia("2026-09-07", ESTADOS_DIA.FALTA), dia("2026-09-08", ESTADOS_DIA.PRESENTE)];
    expect(calcularNomina({ dias, sueldoSemanal: 2100, config: CONFIG }).pagoFinal).toBe(1800);
  });

  it("un día justificado no descuenta nada", () => {
    const dias = [dia("2026-09-07", ESTADOS_DIA.JUSTIFICADO)];
    const r = calcularNomina({ dias, sueldoSemanal: 1000, config: CONFIG });
    expect(r.descuento).toBe(0);
    expect(r.pagoFinal).toBe(1000);
  });

  it("el pago final nunca es negativo", () => {
    const dias = [
      dia("2026-09-07", ESTADOS_DIA.FALTA),
      dia("2026-09-08", ESTADOS_DIA.FALTA),
      dia("2026-09-09", ESTADOS_DIA.FALTA),
    ];
    const r = calcularNomina({ dias, sueldoSemanal: 500, config: CONFIG });
    expect(r.descuento).toBe(900);
    expect(r.pagoFinal).toBe(0);
  });

  it("sin sueldo capturado lo dice, en vez de enseñar un pago de cero como si fuera un cálculo", () => {
    const dias = [dia("2026-09-07", ESTADOS_DIA.RETARDO)];
    for (const sueldo of [null, undefined, 0, ""]) {
      const r = calcularNomina({ dias, sueldoSemanal: sueldo, config: CONFIG });
      expect(r.sinSueldo).toBe(true);
      expect(r.pagoFinal).toBe(0);
    }
  });

  it("redondea a centavos en vez de arrastrar restos de flotante", () => {
    const dias = [dia("2026-09-07", ESTADOS_DIA.RETARDO), dia("2026-09-08", ESTADOS_DIA.RETARDO)];
    const r = calcularNomina({ dias, sueldoSemanal: 1000.1, config: { montoRetardo: 0.1, montoFalta: 0 } });
    expect(r.descuento).toBe(0.2);
    expect(r.pagoFinal).toBe(999.9);
  });

  it("una semana sin días devuelve el sueldo íntegro", () => {
    const r = calcularNomina({ dias: [], sueldoSemanal: 1500, config: CONFIG });
    expect(r.descuento).toBe(0);
    expect(r.pagoFinal).toBe(1500);
  });

  it("el detalle trae el descuento de cada día, para poder pintarlo bajo su letra", () => {
    const dias = [dia("2026-09-07", ESTADOS_DIA.RETARDO), dia("2026-09-08", ESTADOS_DIA.PRESENTE)];
    const { detalle } = calcularNomina({ dias, sueldoSemanal: 1000, config: CONFIG });
    expect(detalle.map((d) => d.descuento)).toEqual([50, 0]);
    expect(detalle[0].fecha).toBe("2026-09-07"); // no pierde lo que ya traía el día
  });
});

describe("money", () => {
  it("formatea pesos y aguanta un valor ausente", () => {
    expect(money(1600)).toContain("1,600");
    expect(money(null)).toContain("0");
  });
});
