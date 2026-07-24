import { describe, it, expect } from "vitest";
import { construirFraseChecada } from "./voz";

// La confirmación hablada del checador. Solo se prueba la parte pura (el texto); el motor de voz
// del navegador no se puede ejercitar en Node.
describe("construirFraseChecada", () => {
  it("entrada puntual: hora, sin retardo", () => {
    expect(construirFraseChecada("entrada", "9:00")).toBe("Entrada registrada a las 9:00.");
  });

  it("entrada tarde: dice 'con retardo', tal como se pidió", () => {
    expect(construirFraseChecada("entrada", "9:15", { tarde: true })).toBe(
      "Entrada registrada a las 9:15, con retardo.",
    );
  });

  it("salida: nunca lleva retardo y se despide", () => {
    expect(construirFraseChecada("salida", "18:00", { tarde: true })).toBe(
      "Salida registrada a las 18:00. Buen día.",
    );
  });

  it("fuera de la sucursal: añade el aviso al final", () => {
    expect(construirFraseChecada("entrada", "9:00", { fuera: true })).toBe(
      "Entrada registrada a las 9:00. Ojo, registraste fuera de la sucursal.",
    );
  });

  it("tarde y fuera a la vez: ambos avisos", () => {
    expect(construirFraseChecada("entrada", "9:20", { tarde: true, fuera: true })).toBe(
      "Entrada registrada a las 9:20, con retardo. Ojo, registraste fuera de la sucursal.",
    );
  });
});
