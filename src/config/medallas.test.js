import { describe, it, expect } from "vitest";
import { MEDALLAS, CATEGORIAS_MEDALLA, getMedalla } from "./medallas";

describe("medallas", () => {
  it("cada categoría tiene ícono y color", () => {
    for (const cat of CATEGORIAS_MEDALLA) {
      const m = MEDALLAS[cat];
      expect(m.icono).toBeTruthy();
      expect(m.color).toMatch(/^var\(--mc-/);
    }
  });

  it("getMedalla devuelve la medalla de la categoría", () => {
    expect(getMedalla("Puntualidad").icono).toBe("clock");
  });

  it("una categoría desconocida cae en el fallback, nunca rompe", () => {
    const m = getMedalla("Categoría inventada");
    expect(m.icono).toBeTruthy();
    expect(m.color).toMatch(/^var\(--mc-/);
  });

  it("tolera null/undefined", () => {
    expect(getMedalla(null).icono).toBeTruthy();
    expect(getMedalla(undefined).icono).toBeTruthy();
  });
});
