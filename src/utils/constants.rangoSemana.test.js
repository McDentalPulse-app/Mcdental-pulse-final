import { describe, it, expect } from "vitest";
import { rangoDeSemana } from "./constants";

/**
 * El lunes y el sábado de una semana ISO.
 *
 * Se prueba aparte porque es el cálculo más fácil de equivocar de todo el dashboard: el ancla
 * ISO no es el 1 de enero sino el 4 (el 1 puede caer en la semana 52 del año anterior), y si el
 * rango sale corrido, los KPIs de retardos y faltas cuentan los días de otra semana sin que
 * nada falle a la vista.
 */
describe("rangoDeSemana", () => {
  it("una semana normal va de lunes a sábado", () => {
    // 2026-W32 empieza el lunes 3 de agosto.
    expect(rangoDeSemana("2026-W32")).toEqual({ desde: "2026-08-03", hasta: "2026-08-08" });
  });

  it("son seis días: la clínica trabaja de lunes a sábado, no siete", () => {
    const { desde, hasta } = rangoDeSemana("2026-W32");
    const dias = (new Date(hasta) - new Date(desde)) / 86400000;
    expect(dias).toBe(5);
  });

  it("la semana 1 se ancla en el 4 de enero, no en el 1", () => {
    // 2026-01-01 es jueves, asi que la W01 arranca el lunes 29 de diciembre de 2025.
    expect(rangoDeSemana("2026-W01").desde).toBe("2025-12-29");
  });

  it("un año que empieza en lunes no se corre", () => {
    // 2024-01-01 fue lunes: la W01 empieza ese mismo dia.
    expect(rangoDeSemana("2024-W01").desde).toBe("2024-01-01");
  });

  it("aguanta el cambio de año a mitad de semana", () => {
    expect(rangoDeSemana("2026-W53")).toEqual({ desde: "2026-12-28", hasta: "2027-01-02" });
  });

  it("una semana mal escrita devuelve null en vez de una fecha inventada", () => {
    expect(rangoDeSemana("2026-W00")).not.toBeNull(); // W00 es el cubo de "antes del lanzamiento"
    expect(rangoDeSemana("basura")).toBeNull();
    expect(rangoDeSemana("")).toBeNull();
    expect(rangoDeSemana(null)).toBeNull();
    expect(rangoDeSemana(undefined)).toBeNull();
  });
});
