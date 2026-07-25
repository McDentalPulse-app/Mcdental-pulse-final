import { describe, it, expect } from "vitest";
import { analyzeEmployeeAI } from "./aiRiskEngine";

// El motor de riesgo decide la prioridad de intervención de un empleado. Estos tests
// fijan las reglas para que un cambio en cómo se cargan las encuestas no altere en
// silencio a quién se marca como crítico.

const empleado = { id: "a", name: "Empleado A" };
const enc = (semana, score) => ({ empleadoId: "a", semana, score, respuestas: {} });

describe("analyzeEmployeeAI", () => {
  it("sin encuestas devuelve sinDatos y prioridad 'Sin datos'", () => {
    const r = analyzeEmployeeAI(empleado, []);

    expect(r.sinDatos).toBe(true);
    expect(r.prioridad).toBe("Sin datos");
    expect(r.pulse).toBeNull();
    expect(r.recomendacion).toMatch(/Sin encuestas/);
  });

  // Regresión del bug del score nulo. Es la consecuencia más grave: una encuesta sin
  // score se contaba como un 0 real y escalaba al empleado hasta "Crítica" +
  // "intervención inmediata" — una alarma psicológica falsa. La rama de "sin score
  // válido" existía en el código pero era inalcanzable, porque Number(null) === 0.
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["cadena vacía", ""],
  ])("una encuesta con score %s es 'sin datos', NO un crítico con 0 puntos", (_, invalido) => {
    const r = analyzeEmployeeAI(empleado, [
      { empleadoId: "a", semana: "2026-W01", score: invalido },
    ]);

    expect(r.sinDatos).toBe(true);
    expect(r.pulse).toBeNull();
    expect(r.prioridad).toBe("Sin datos");
    expect(r.recomendacion).toMatch(/sin score válido/);
    expect(r.recomendacion).not.toMatch(/intervención inmediata/i);
  });

  it("una encuesta sin score no arrastra al empleado que sí tiene scores sanos", () => {
    const r = analyzeEmployeeAI(empleado, [
      { empleadoId: "a", semana: "2026-W01", score: null },
      { empleadoId: "a", semana: "2026-W02", score: 90 },
    ]);

    expect(r.pulse).toBe(90);
    expect(r.prioridad).toBe("Baja");
  });

  it("un score bajo o 50 dispara intervención inmediata (Crítica)", () => {
    const r = analyzeEmployeeAI(empleado, [enc("2026-W01", 40)]);

    expect(r.prioridad).toBe("Crítica");
    expect(r.riesgos.some((x) => x.tipo === "Intervención inmediata")).toBe(true);
    expect(r.recomendacion).toMatch(/intervención inmediata/i);
  });

  it("un score sano no genera riesgos por score", () => {
    const r = analyzeEmployeeAI(empleado, [enc("2026-W01", 90)]);

    expect(r.sinDatos).toBe(false);
    expect(r.prioridad).toBe("Baja");
    expect(r.riesgos).toEqual([]);
  });

  it("una caída de 10+ puntos entre mediciones es riesgo Alto", () => {
    const encuestas = [enc("2026-W01", 85), enc("2026-W02", 70)];
    const r = analyzeEmployeeAI(empleado, encuestas);

    expect(r.riesgos.some((x) => x.tipo === "Cambio de comportamiento")).toBe(true);
    expect(r.prioridad).toBe("Alta");
  });

  it("un reporte confidencial de urgencia Crítica se registra aunque no haya score", () => {
    const reportes = [{ empleadoId: "a", urgencia: "Crítica" }];
    const r = analyzeEmployeeAI(empleado, [], [], [], [], reportes);

    expect(r.riesgos.some((x) => x.tipo === "Reporte confidencial prioritario")).toBe(true);
  });

  it("dos o más permisos marcan riesgo de ausentismo", () => {
    const permisos = [{ empleadoId: "a" }, { empleadoId: "a" }];
    const r = analyzeEmployeeAI(empleado, [enc("2026-W01", 90)], permisos);

    expect(r.riesgos.some((x) => x.tipo === "Riesgo de ausentismo")).toBe(true);
  });

  it("solo considera los datos del empleado analizado, no los de otros", () => {
    const permisosDeOtro = [{ empleadoId: "b" }, { empleadoId: "b" }];
    const r = analyzeEmployeeAI(empleado, [enc("2026-W01", 90)], permisosDeOtro);

    expect(r.riesgos.some((x) => x.tipo === "Riesgo de ausentismo")).toBe(false);
  });

  it("la prioridad escala al riesgo más grave presente", () => {
    // Score 40 (Crítica) + permisos (Media) => se queda con Crítica.
    const permisos = [{ empleadoId: "a" }, { empleadoId: "a" }];
    const r = analyzeEmployeeAI(empleado, [enc("2026-W01", 40)], permisos);

    expect(r.prioridad).toBe("Crítica");
  });
});
