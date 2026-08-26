import { describe, it, expect } from "vitest";
import {
  periodoActual,
  periodoDisplay,
  esPeriodoActual,
  claveDelPeriodo,
  formatSemanaDisplay,
} from "./constants";

/**
 * El PERÍODO DE LA ENCUESTA (Fase 0 de plan-encuesta-quincenal.md).
 *
 * Estas pruebas NO fijan que el período sea la semana — eso va a cambiar cuando la encuesta
 * pase a quincenal. Fijan la COHERENCIA entre las cuatro piezas, que es lo que tiene que
 * seguir siendo verdad antes y después de ese cambio.
 *
 * El fallo que previenen es concreto: si la clave con la que se GUARDA una encuesta no es la
 * que el portón de «¿ya contestó?» reconoce, la persona manda su encuesta y la app se la
 * vuelve a pedir de inmediato, con el `unique` de la base rechazando el segundo envío. Es
 * justo el tipo de desajuste que puede aparecer al cambiar la cadencia en un sitio y no en
 * otro.
 */
describe("periodo de la encuesta", () => {
  it("la clave que se escribe es la que el portón reconoce", () => {
    expect(esPeriodoActual(claveDelPeriodo())).toBe(true);
  });

  it("periodoActual coincide con la clave que se escribiría ahora", () => {
    expect(periodoActual).toBe(claveDelPeriodo());
  });

  it("la etiqueta visible se deriva del período activo", () => {
    expect(periodoDisplay).toBe(formatSemanaDisplay(periodoActual));
  });

  it("el portón rechaza claves vacías, nulas y de otros períodos", () => {
    expect(esPeriodoActual("")).toBe(false);
    expect(esPeriodoActual(null)).toBe(false);
    expect(esPeriodoActual(undefined)).toBe(false);
    expect(esPeriodoActual("2025-W15")).toBe(false);
  });

  it("el portón tolera espacios alrededor, como las claves ya guardadas", () => {
    expect(esPeriodoActual(` ${claveDelPeriodo()} `)).toBe(true);
  });
});
