import { describe, it, expect } from "vitest";
import { calcularNomina, descuentoDelDia, DESCUENTOS_DEFECTO, money } from "./nomina";
import { ESTADOS_DIA } from "./asistencia";

const CONFIG = { montoRetardo: 50 };

/** Un día ya clasificado, como los que devuelve construirDias(). */
const dia = (fecha, estado) => ({ fecha, estado, minutosRetardo: 0 });

describe("descuentoDelDia", () => {
  it("cobra el monto fijo del retardo", () => {
    expect(descuentoDelDia(ESTADOS_DIA.RETARDO, { config: CONFIG, sueldoSemanal: 2000 })).toBe(50);
  });

  it("un becario paga $50 de retardo sin importar la tasa general configurada", () => {
    expect(
      descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: 999 }, sueldoSemanal: 2000, puesto: "Becario Sistemas" }),
    ).toBe(50);
    expect(
      descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: 999 }, sueldoSemanal: 2000, puesto: "Becaria marketing" }),
    ).toBe(50);
    expect(
      descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: 10 }, sueldoSemanal: 2000, puesto: "Becario Marketing" }),
    ).toBe(50);
  });

  it("alguien que no es becario paga la tasa general, no la de becario", () => {
    expect(
      descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: 100 }, sueldoSemanal: 2000, puesto: "Recepcionista" }),
    ).toBe(100);
    expect(descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: 100 }, sueldoSemanal: 2000, puesto: null })).toBe(100);
    expect(descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: 100 }, sueldoSemanal: 2000, puesto: "" })).toBe(100);
  });

  it("el monto personal gana sobre TODO lo demás, becario incluido", () => {
    // Alexis Alan Rafael Castañeda (Técnico de Mantenimiento, no becario): $50 personal aunque
    // la tasa general sea otra.
    expect(
      descuentoDelDia(ESTADOS_DIA.RETARDO, {
        config: { montoRetardo: 100 },
        puesto: "Técnico de Mantenimiento",
        montoRetardoPersonal: 50,
      }),
    ).toBe(50);
    // Y también gana si la persona SÍ es becaria: el monto personal es más específico.
    expect(
      descuentoDelDia(ESTADOS_DIA.RETARDO, {
        config: { montoRetardo: 100 },
        puesto: "Becario Sistemas",
        montoRetardoPersonal: 20,
      }),
    ).toBe(20);
  });

  it("monto personal en 0 descuenta 0, no cae a la tasa general", () => {
    expect(
      descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: 100 }, montoRetardoPersonal: 0 }),
    ).toBe(0);
  });

  it("la tasa de becario no afecta la falta, que sigue siendo el sueldo diario", () => {
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, { config: CONFIG, sueldoSemanal: 2100, puesto: "Becario Sistemas" })).toBe(300);
  });

  it("cobra el sueldo diario de la persona por la falta: sueldoSemanal entre 7", () => {
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, { config: CONFIG, sueldoSemanal: 2100 })).toBe(300);
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, { config: CONFIG, sueldoSemanal: 2000 })).toBeCloseTo(285.71, 2);
  });

  it("la falta no usa ningún monto de la configuración, solo el sueldo de la persona", () => {
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, { config: { montoRetardo: 999 }, sueldoSemanal: 700 })).toBe(100);
  });

  it("no cobra nada por los días que no son ni retardo ni falta", () => {
    for (const estado of [
      ESTADOS_DIA.PRESENTE,
      ESTADOS_DIA.JUSTIFICADO,
      ESTADOS_DIA.DESCANSO,
      ESTADOS_DIA.FESTIVO,
      ESTADOS_DIA.PENDIENTE,
      ESTADOS_DIA.PRUEBA,
      // "Sin salida" es un caso que RH tiene que mirar, no un descuento automático.
      ESTADOS_DIA.INCOMPLETO,
    ]) {
      expect(descuentoDelDia(estado, { config: CONFIG, sueldoSemanal: 2000 })).toBe(0);
    }
  });

  it("sin configuración ni sueldo no descuenta nada (mejor eso que inventar un monto)", () => {
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, { config: DESCUENTOS_DEFECTO, sueldoSemanal: null })).toBe(0);
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, {})).toBe(0);
    expect(descuentoDelDia(ESTADOS_DIA.FALTA)).toBe(0);
    expect(descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: null }, sueldoSemanal: 2000 })).toBe(0);
    expect(descuentoDelDia(ESTADOS_DIA.RETARDO, { config: { montoRetardo: "abc" }, sueldoSemanal: 2000 })).toBe(0);
    expect(descuentoDelDia(ESTADOS_DIA.FALTA, { config: CONFIG, sueldoSemanal: "abc" })).toBe(0);
  });
});

describe("calcularNomina", () => {
  it("descuenta cada retardo con el monto fijo y cada falta con el sueldo diario de la persona", () => {
    const dias = [
      dia("2026-09-07", ESTADOS_DIA.PRESENTE),
      dia("2026-09-08", ESTADOS_DIA.RETARDO),
      dia("2026-09-09", ESTADOS_DIA.RETARDO),
      dia("2026-09-10", ESTADOS_DIA.FALTA),
      dia("2026-09-11", ESTADOS_DIA.PRESENTE),
      dia("2026-09-12", ESTADOS_DIA.DESCANSO),
    ];
    // Sueldo 2100 → diario 300. Descuento: 50 + 50 (retardos) + 300 (falta) = 400.
    const r = calcularNomina({ dias, sueldoSemanal: 2100, config: CONFIG });

    expect(r.retardos).toBe(2);
    expect(r.faltas).toBe(1);
    expect(r.descuento).toBe(400);
    expect(r.pagoFinal).toBe(1700);
    expect(r.sinSueldo).toBe(false);
  });

  it("un becario paga $50 por retardo aunque la tasa general de la empresa sea otra", () => {
    const dias = [dia("2026-09-07", ESTADOS_DIA.RETARDO), dia("2026-09-08", ESTADOS_DIA.RETARDO)];
    const general = calcularNomina({ dias, sueldoSemanal: 2000, config: { montoRetardo: 100 } });
    const becario = calcularNomina({
      dias,
      sueldoSemanal: 2000,
      config: { montoRetardo: 100 },
      puesto: "Becario Sistemas",
    });

    expect(general.descuento).toBe(200); // 2 retardos × 100
    expect(becario.descuento).toBe(100); // 2 retardos × 50
  });

  it("alguien con monto de retardo personal paga eso, no la tasa general ni la de becario", () => {
    const dias = [dia("2026-09-07", ESTADOS_DIA.RETARDO), dia("2026-09-08", ESTADOS_DIA.RETARDO)];
    const r = calcularNomina({
      dias,
      sueldoSemanal: 2500,
      config: { montoRetardo: 100 },
      puesto: "Técnico de Mantenimiento",
      montoRetardoPersonal: 50,
    });
    expect(r.descuento).toBe(100); // 2 retardos × 50 (personal), no × 100 (general)
  });

  it("dos personas con el mismo número de faltas pero distinto sueldo pierden montos distintos", () => {
    const dias = [dia("2026-09-07", ESTADOS_DIA.FALTA), dia("2026-09-08", ESTADOS_DIA.PRESENTE)];
    const barata = calcularNomina({ dias, sueldoSemanal: 1400, config: CONFIG }); // diario 200
    const cara = calcularNomina({ dias, sueldoSemanal: 4200, config: CONFIG }); // diario 600

    expect(barata.descuento).toBe(200);
    expect(cara.descuento).toBe(600);
  });

  it("la falta descuenta SOLO su día: el resto del sueldo semanal no se toca aparte", () => {
    // Sueldo 2100, diario 300, una falta: el pago es 1800 — NO 1800 menos otra cosa además.
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
    // Un séptimo del sueldo por falta nunca por sí solo supera el sueldo entero, así que aquí
    // se combina con retardos (monto fijo, independiente del sueldo) para superarlo de verdad.
    const dias = [
      dia("2026-09-07", ESTADOS_DIA.FALTA),
      dia("2026-09-08", ESTADOS_DIA.RETARDO),
      dia("2026-09-09", ESTADOS_DIA.RETARDO),
    ];
    const r = calcularNomina({ dias, sueldoSemanal: 100, config: { montoRetardo: 100 } });
    expect(r.descuento).toBeGreaterThan(100);
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
    const r = calcularNomina({ dias, sueldoSemanal: 1000.1, config: { montoRetardo: 0.1 } });
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
