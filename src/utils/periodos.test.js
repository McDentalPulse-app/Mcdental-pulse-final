import { describe, it, expect } from "vitest";
import { quincenaDe, mesDeSemana, periodoDe, encuestaEnPeriodo, periodosDisponibles, inicioDePeriodo, finDePeriodo, esPeriodoDePrueba } from "./periodos";

// Las quincenas van de sábado a viernes ancladas al sábado de la semana de lanzamiento
// (2026-07-04), que es como se trabaja y se paga aquí: lunes a sábado.
describe("quincenaDe", () => {
  it("18 jul y 31 jul son la MISMA quincena", () => {
    expect(quincenaDe("2026-07-18").id).toBe("2026-07-18");
    expect(quincenaDe("2026-07-31").id).toBe("2026-07-18");
    expect(quincenaDe("2026-07-18").fin).toBe("2026-07-31");
  });

  it("el 17 de julio todavía es la anterior, y el 1 de agosto ya es la siguiente", () => {
    // El corte es el sábado: un día antes o un día después cambia de quincena.
    expect(quincenaDe("2026-07-17").id).toBe("2026-07-04");
    expect(quincenaDe("2026-08-01").id).toBe("2026-08-01");
  });
});

describe("mesDeSemana", () => {
  it("una semana entera pertenece al mes de su lunes", () => {
    // La W31 empieza el lunes 27 de julio: es de julio aunque se conteste el 1 de agosto.
    expect(mesDeSemana("2026-W31")).toBe("2026-07");
    expect(mesDeSemana("2026-W32")).toBe("2026-08");
  });
});

describe("periodoDe / encuestaEnPeriodo", () => {
  const contestadaEnAgosto = { semana: "2026-W31", fecha: "2026-08-01" };

  it("por mes cuenta en julio, aunque la respuesta lleve fecha de agosto", () => {
    // Este es el caso que antes partía la semana entre dos meses y dejaba a los dos incompletos.
    expect(periodoDe(contestadaEnAgosto, "mes").id).toBe("2026-07");
    expect(encuestaEnPeriodo(contestadaEnAgosto, "mes", "2026-08")).toBe(false);
  });

  it("por quincena manda la fecha de respuesta, no la semana", () => {
    expect(periodoDe(contestadaEnAgosto, "quincena").id).toBe("2026-08-01");
  });

  it("por semana manda la columna guardada", () => {
    expect(encuestaEnPeriodo(contestadaEnAgosto, "semana", "2026-W31")).toBe(true);
    expect(encuestaEnPeriodo(contestadaEnAgosto, "semana", "2026-W30")).toBe(false);
  });
});

describe("periodosDisponibles", () => {
  it("del más reciente al más antiguo y sin repetir", () => {
    const encuestas = [
      { semana: "2026-W29", fecha: "2026-07-15" },
      { semana: "2026-W31", fecha: "2026-07-27" },
      { semana: "2026-W29", fecha: "2026-07-16" },
    ];
    const ids = periodosDisponibles(encuestas, "semana").map((p) => p.id);
    expect(ids).toContain("2026-W31");
    expect(ids).toContain("2026-W29");
    expect(ids.filter((i) => i === "2026-W29")).toHaveLength(1);
    expect([...ids].sort().reverse()).toEqual(ids);
  });
});

describe("etiquetas del selector", () => {
  it("las semanas previas al lanzamiento no salen todas con el mismo nombre", () => {
    // formatSemanaDisplay junta todo lo anterior al lanzamiento en "2026-W00": en el selector
    // eso eran dos opciones distintas escritas igual, imposibles de distinguir.
    const a = periodoDe({ semana: "2025-W15" }, "semana");
    const b = periodoDe({ semana: "2026-W01" }, "semana");
    expect(a.etiqueta).not.toBe(b.etiqueta);
    expect(a.etiqueta).toContain("2025-W15");
  });

  it("las semanas normales conservan su etiqueta corta", () => {
    expect(periodoDe({ semana: "2026-W31" }, "semana").etiqueta).toBe("2026-W05");
  });
});

describe("periodo de prueba", () => {
  it("sabe cuando termina cada tipo de periodo", () => {
    expect(finDePeriodo("semana", "2026-W31")).toBe("2026-08-02");
    expect(finDePeriodo("quincena", "2026-07-18")).toBe("2026-07-31");
    expect(finDePeriodo("mes", "2026-07")).toBe("2026-07-31");
  });

  it("es de prueba lo que termina dentro de la prueba", () => {
    expect(esPeriodoDePrueba("quincena", "2026-07-18")).toBe(true);
    expect(esPeriodoDePrueba("mes", "2026-07")).toBe(true);
  });

  it("un periodo que cruza el corte ya cuenta como normal", () => {
    // La semana del 27 de julio termina el 2 de agosto: en su segunda mitad ya se podia
    // contestar, asi que ahi el silencio si es "no contesto".
    expect(esPeriodoDePrueba("semana", "2026-W31")).toBe(false);
    expect(esPeriodoDePrueba("mes", "2026-08")).toBe(false);
  });
});

/**
 * El periodo del reporte es la SEMANA.
 *
 * Este bloque fijaba lo contrario del 6 al 17 de agosto de 2026, mientras la encuesta fue
 * quincenal por un requisito mal entendido (lo que rota cada 15 días son las PREGUNTAS del
 * bloque, no la encuesta). Se reescribe en vez de borrarse porque los casos que mide siguen
 * siendo los mismos —id, etiqueta, duración y selector—, solo que con la respuesta de siempre.
 */
describe("el periodo del reporte es la SEMANA", () => {
  it("cada semana es su propio periodo", () => {
    const a = periodoDe({ semana: "2026-W33" }, "semana");
    const b = periodoDe({ semana: "2026-W34" }, "semana");
    expect(a.id).toBe("2026-W33");
    expect(b.id).toBe("2026-W34");
    expect(a.etiqueta).not.toBe(b.etiqueta);
  });

  it("una encuesta de otra semana NO cuenta en este periodo", () => {
    expect(encuestaEnPeriodo({ semana: "2026-W34" }, "semana", "2026-W33")).toBe(false);
    expect(encuestaEnPeriodo({ semana: "2026-W33" }, "semana", "2026-W33")).toBe(true);
  });

  it("la etiqueta es el numero de semana, sin hablar de quincenas", () => {
    const p = periodoDe({ semana: "2026-W33" }, "semana");
    expect(p.etiqueta).toBe("2026-W07");
    expect(p.etiqueta).not.toContain("Quincena");
  });

  it("el periodo dura 7 dias", () => {
    // Este valor acota el rango del reporte de asistencia, asi que no es solo una etiqueta:
    // devolver 14 dias metia en la hoja una semana que no toca.
    expect(inicioDePeriodo("semana", "2026-W33")).toBe("2026-08-10");
    expect(finDePeriodo("semana", "2026-W33")).toBe("2026-08-16");
    expect(finDePeriodo("semana", "2026-W31")).toBe("2026-08-02");
    expect(periodoDe({ semana: "2026-W31" }, "semana").etiqueta).toBe("2026-W05");
  });

  it("el selector ofrece las dos semanas por separado, sin repetir ninguna", () => {
    const periodos = periodosDisponibles(
      [{ semana: "2026-W33" }, { semana: "2026-W34" }, { semana: "2026-W31" }],
      "semana"
    );
    const ids = periodos.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("2026-W33");
    expect(ids).toContain("2026-W34");
  });
});
