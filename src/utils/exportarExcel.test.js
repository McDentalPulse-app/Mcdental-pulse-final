import { describe, it, expect } from "vitest";
import { valorDeCelda } from "./exportarExcel";

// Lo que rompía los reportes no era el acento ni la coma: era que TODO llegaba a Excel como
// texto, y que "Sin datos" se colaba en columnas de números. Estos casos fijan las dos cosas.
describe("valorDeCelda", () => {
  it("un número se queda número, no texto", () => {
    expect(valorDeCelda(87, "numero")).toBe(87);
    expect(valorDeCelda("87", "numero")).toBe(87);
    expect(valorDeCelda(7.5, "decimal")).toBe(7.5);
  });

  it("'Sin datos' en una columna numérica deja la celda vacía, no el texto", () => {
    // Con el texto dentro, un PROMEDIO() sobre esa columna devuelve error aunque las demás
    // celdas sean correctas.
    expect(valorDeCelda("Sin datos", "numero")).toBeNull();
    expect(valorDeCelda(undefined, "decimal")).toBeNull();
    expect(valorDeCelda("", "numero")).toBeNull();
  });

  it("las columnas de texto se quedan tal cual, y sin dato es cadena vacía", () => {
    expect(valorDeCelda("Sin datos", "texto")).toBe("Sin datos");
    expect(valorDeCelda("Semana 31", undefined)).toBe("Semana 31");
    expect(valorDeCelda(null, "texto")).toBe("");
  });
});
