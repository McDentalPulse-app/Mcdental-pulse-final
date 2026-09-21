import { describe, it, expect } from "vitest";
import {
  salarioDiario,
  diasTrabajadosEnAnio,
  calcularAguinaldo,
  calcularFiniquito,
  calcularLiquidacion,
  DIAS_AGUINALDO_MINIMO,
} from "./finiquito";

describe("salarioDiario", () => {
  it("es el sueldo semanal entre 7, igual que la fórmula de la falta en nomina.js", () => {
    expect(salarioDiario(2100)).toBe(300);
  });

  it("no revienta ni da negativo con basura", () => {
    expect(salarioDiario(null)).toBe(0);
    expect(salarioDiario(-500)).toBe(0);
  });
});

describe("diasTrabajadosEnAnio", () => {
  it("cuenta desde el 1 de enero para quien entró en años anteriores", () => {
    // El aguinaldo de años previos ya se pagó por su cuenta; solo cuenta el año en curso.
    expect(diasTrabajadosEnAnio("2020-03-10", "2026-01-01")).toBe(1);
    expect(diasTrabajadosEnAnio("2020-03-10", "2026-12-31")).toBe(365);
  });

  it("cuenta desde la fecha de ingreso para quien entró ESTE año", () => {
    expect(diasTrabajadosEnAnio("2026-06-01", "2026-06-01")).toBe(1);
    expect(diasTrabajadosEnAnio("2026-06-01", "2026-06-10")).toBe(10);
  });
});

describe("calcularAguinaldo", () => {
  it("un año completo trabajado da el aguinaldo completo (15 días)", () => {
    const r = calcularAguinaldo({ sueldoSemanal: 2100, fechaIngreso: "2020-01-01", fecha: "2026-12-31" });
    expect(r.salarioDiario).toBe(300);
    expect(r.montoAguinaldo).toBe(15 * 300); // 4500
  });

  it("proporcional: medio año trabajado da aproximadamente la mitad", () => {
    // 2026-07-02 es el día 183 de un año de 365 — no exactamente la mitad, pero cerca.
    const r = calcularAguinaldo({ sueldoSemanal: 2100, fechaIngreso: "2020-01-01", fecha: "2026-07-02" });
    expect(r.diasTrabajadosAnio).toBe(183);
    expect(r.montoAguinaldo).toBeCloseTo((15 * 300 * 183) / 365, 2);
  });

  it("acepta un aguinaldo mayor al mínimo legal (decisión de la empresa)", () => {
    const r = calcularAguinaldo({
      sueldoSemanal: 2100, fechaIngreso: "2020-01-01", fecha: "2026-12-31", diasAguinaldo: 20,
    });
    expect(r.diasAguinaldo).toBe(20);
    expect(r.montoAguinaldo).toBe(20 * 300);
  });

  it("el default es el mínimo de ley (15 días, Art. 87 LFT)", () => {
    expect(DIAS_AGUINALDO_MINIMO).toBe(15);
  });
});

describe("calcularFiniquito", () => {
  it("suma días pendientes + vacaciones + prima vacacional + aguinaldo proporcional", () => {
    // Entró hace años, año completo trabajado, sin vacaciones tomadas en el periodo vigente
    // (8 días disponibles, la política de la clínica — ver vacaciones.js).
    const r = calcularFiniquito({
      sueldoSemanal: 2100,
      fechaIngreso: "2020-03-10",
      fechaSalida: "2026-09-21",
      vacacionesEmpleado: [],
      diasPendientesPago: 3,
    });
    expect(r.salarioDiario).toBe(300);
    expect(r.montoDiasPendientes).toBe(3 * 300); // 900
    expect(r.diasVacacionesPendientes).toBe(8); // saldoVacaciones: 8 días/año, ninguno tomado
    expect(r.montoVacaciones).toBe(8 * 300); // 2400
    expect(r.montoPrimaVacacional).toBe(2400 * 0.25); // 600
    expect(r.total).toBe(r.montoDiasPendientes + r.montoVacaciones + r.montoPrimaVacacional + r.montoAguinaldo);
  });

  it("descuenta las vacaciones ya tomadas del saldo pendiente de pago", () => {
    const vacacionesEmpleado = [{ fechaInicio: "2026-04-01", fechaFin: "2026-04-03", estado: "aprobado" }];
    const r = calcularFiniquito({
      sueldoSemanal: 2100,
      fechaIngreso: "2020-03-10",
      fechaSalida: "2026-09-21",
      vacacionesEmpleado,
    });
    expect(r.diasVacacionesPendientes).toBe(5); // 8 - 3 ya tomados
  });

  it("suma otras percepciones pactadas (comisiones, bonos) al total", () => {
    const sin = calcularFiniquito({ sueldoSemanal: 2100, fechaIngreso: "2020-03-10", fechaSalida: "2026-09-21" });
    const con = calcularFiniquito({
      sueldoSemanal: 2100, fechaIngreso: "2020-03-10", fechaSalida: "2026-09-21", otrasPercepciones: 1000,
    });
    expect(con.total).toBe(sin.total + 1000);
  });
});

describe("calcularLiquidacion", () => {
  it("es el finiquito más indemnización de 90 días, 20 días por año y prima de antigüedad", () => {
    const r = calcularLiquidacion({
      sueldoSemanal: 2100,
      fechaIngreso: "2020-09-21", // exactamente 6 años cumplidos a la fecha de salida
      fechaSalida: "2026-09-21",
      vacacionesEmpleado: [],
    });
    expect(r.aniosAntiguedad).toBe(6);
    expect(r.montoIndemnizacion).toBe(90 * 300); // 27000
    expect(r.montoVeinteDias).toBe(20 * 300 * 6); // 36000
    expect(r.montoPrimaAntiguedad).toBe(12 * 300 * 6); // 21600, sin tope (no se dio salarioMinimoDiario)
    expect(r.primaAntiguedadTopada).toBe(false);
  });

  it("topa la prima de antigüedad a 2 salarios mínimos diarios cuando se da el salario mínimo", () => {
    // Salario diario de 300, tope de 2 x 100 = 200: la prima se calcula sobre 200, no 300.
    const r = calcularLiquidacion({
      sueldoSemanal: 2100,
      fechaIngreso: "2024-09-21",
      fechaSalida: "2026-09-21",
      salarioMinimoDiario: 100,
    });
    expect(r.aniosAntiguedad).toBe(2);
    expect(r.montoPrimaAntiguedad).toBe(12 * 200 * 2); // 4800, no 12*300*2=7200
    expect(r.primaAntiguedadTopada).toBe(true);
  });

  it("sin tope (salario diario ya por debajo de 2 mínimos) no se toca", () => {
    const r = calcularLiquidacion({
      sueldoSemanal: 700, // salario diario 100
      fechaIngreso: "2024-09-21",
      fechaSalida: "2026-09-21",
      salarioMinimoDiario: 100, // tope 200, por encima del salario diario real
    });
    expect(r.primaAntiguedadTopada).toBe(false);
    expect(r.montoPrimaAntiguedad).toBe(12 * 100 * 2);
  });
});
