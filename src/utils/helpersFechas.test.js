import { describe, it, expect } from "vitest";
import { formatFechaCorta, formatRangoFechas } from "./helpers";

/**
 * El rango de fechas de vacaciones y permisos.
 *
 * Existe por un fallo que estuvo a la vista sin que nadie lo leyera como fallo: la pantalla de
 * vacaciones pedía `v.inicio` y `v.fin`, campos que el servicio nunca devolvió (son
 * `fechaInicio` y `fechaFin`), así que pintaba « al » — la palabra suelta, sin fechas a los
 * lados— y debajo «5 días». Nadie sabía de qué día a qué día eran las vacaciones que estaba
 * aprobando.
 */
describe("formatFechaCorta", () => {
  it("una fecha suelta se lee corta", () => {
    expect(formatFechaCorta("2026-08-20")).toMatch(/20/);
    expect(formatFechaCorta("2026-08-20")).toMatch(/2026/);
  });

  it("NO se corre al día anterior", () => {
    // Sin anclar a mediodía, "2026-08-20" se interpreta como medianoche UTC y en México cae en
    // el 19. Unas vacaciones del 20 al 24 se mostrarían del 19 al 23.
    expect(formatFechaCorta("2026-08-20")).toMatch(/\b20\b/);
    expect(formatFechaCorta("2026-01-01")).toMatch(/\b01\b/);
  });

  it("acepta un timestamp completo y se queda con el día", () => {
    expect(formatFechaCorta("2026-08-20T23:30:00Z")).toMatch(/\b20\b/);
  });

  it("sin fecha no inventa nada", () => {
    expect(formatFechaCorta(null)).toBe("");
    expect(formatFechaCorta("")).toBe("");
    expect(formatFechaCorta("basura")).toBe("");
  });
});

describe("formatRangoFechas", () => {
  it("un rango de varios días se dice entero", () => {
    const r = formatRangoFechas("2026-08-20", "2026-08-24");
    expect(r).toMatch(/\b20\b/);
    expect(r).toMatch(/\b24\b/);
    expect(r).toContain(" al ");
  });

  it("un solo día no se repite dos veces", () => {
    const r = formatRangoFechas("2026-08-20", "2026-08-20");
    expect(r).not.toContain(" al ");
    expect(r).toMatch(/\b20\b/);
  });

  it("sin fecha fin es UN SOLO DÍA, no un rango abierto", () => {
    // En permisos, fecha_fin nulo significa permiso de un solo día (migración 038). Decir
    // "Desde el 10 de agosto" afirmaría que sigue abierto, que es falso.
    const r = formatRangoFechas("2026-08-20", null);
    expect(r).not.toMatch(/desde/i);
    expect(r).not.toContain(" al ");
    expect(r).toMatch(/\b20\b/);
  });

  it("con solo fecha fin tampoco inventa un rango", () => {
    const r = formatRangoFechas(null, "2026-08-24");
    expect(r).not.toContain(" al ");
    expect(r).toMatch(/\b24\b/);
  });

  it("sin ninguna de las dos lo dice, en vez de dejar la palabra 'al' sola", () => {
    // El fallo original, convertido en prueba: nunca debe quedar un "al" sin fechas.
    expect(formatRangoFechas(null, null)).toBe("Sin fechas");
    expect(formatRangoFechas(undefined, undefined)).toBe("Sin fechas");
  });
});
