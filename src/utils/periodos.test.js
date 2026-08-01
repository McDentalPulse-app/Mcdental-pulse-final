import { describe, it, expect } from "vitest";
import { quincenaDe, mesDeSemana, periodoDe, encuestaEnPeriodo, periodosDisponibles } from "./periodos";

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
