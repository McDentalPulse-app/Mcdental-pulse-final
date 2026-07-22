import { describe, it, expect } from "vitest";
import { generarPaleta, hexAOklch, SEMILLA_TEAL, PRESETS } from "./accentPalette";

describe("generarPaleta — familia de marca por rotación de tono en OKLCH", () => {
  it("con la semilla teal reproduce EXACTAMENTE los valores actuales de index.css", () => {
    const p = generarPaleta(SEMILLA_TEAL);
    // deltaH === 0 → identidad exacta, sin drift del round-trip OKLCH: la app por
    // defecto se ve idéntica a como está horneada en index.css.
    expect(p["--brand-500"].toLowerCase()).toBe("#0e8c7a");
    expect(p["--brand-900"].toLowerCase()).toBe("#0a332e");
    expect(p["--mc-aqua"].toLowerCase()).toBe("#14c8b6");
    expect(p["--mc-marca-texto"].toLowerCase()).toBe("#0b7a6b");
    expect(p["--mc-aqua-rgb"]).toBe("20 200 182");
    expect(p["--mc-verde-rgb"]).toBe("14 140 122");
    expect(p["--mc-verde-oscuro-rgb"]).toBe("0 109 91");
    expect(p["--mc-brand600-rgb"]).toBe("16 116 99");
    // Rotación de tono para las superficies oscuras (oklch(… calc(H + dh))): 0
    // con la semilla teal → cada superficie reproduce su teal exacto.
    expect(p["--mc-brand-dh"]).toBe("0.00");
  });

  it("regenera los tres gradientes de marca", () => {
    const p = generarPaleta(SEMILLA_TEAL);
    expect(p["--grad-accent"].toLowerCase()).toBe(
      "linear-gradient(135deg, #14c8b6 0%, #10a090 100%)"
    );
    expect(p["--grad-brand"]).toContain("linear-gradient(150deg");
    expect(p["--grad-brand-soft"]).toContain("linear-gradient(160deg");
  });

  it("rota el tono en OKLCH conservando la LUMINOSIDAD PERCEPTUAL (L) y el croma", () => {
    const violeta = "#7C3AED";
    const p = generarPaleta(violeta);
    const oBrand = hexAOklch(p["--brand-500"]);
    const oVioleta = hexAOklch(violeta);
    const oTeal = hexAOklch("#0E8C7A");
    // El brand-500 resultante toma el tono OKLCH del violeta elegido.
    // (± unos grados por el recorte a gama sRGB y el redondeo a 8 bits.)
    const dH = Math.abs(oBrand.H - oVioleta.H);
    expect(Math.min(dH, 360 - dH)).toBeLessThan(3);
    // Y conserva la L perceptual del brand-500 teal original — este es el
    // invariante que salva el contraste AA en todo el espectro.
    expect(Math.abs(oBrand.L - oTeal.L)).toBeLessThan(0.01);
  });

  it("preserva la L perceptual del aqua (superficie clara con texto encima)", () => {
    // El aqua lleva texto oscuro fijo (#04231F) en los CTA. Al rotarlo debe
    // mantener su L, para que ese texto siga siendo legible con cualquier color.
    const lAquaTeal = hexAOklch("#14C8B6").L;
    for (const preset of PRESETS) {
      const p = generarPaleta(preset.hex);
      expect(
        Math.abs(hexAOklch(p["--mc-aqua"]).L - lAquaTeal),
        `aqua de ${preset.id} cambió de luminosidad`
      ).toBeLessThan(0.02);
    }
  });

  it("hex inválido cae a la paleta por defecto (teal)", () => {
    expect(generarPaleta("no-soy-color")["--mc-aqua"].toLowerCase()).toBe("#14c8b6");
    expect(generarPaleta(null)["--mc-aqua"].toLowerCase()).toBe("#14c8b6");
    expect(generarPaleta("#12")["--mc-aqua"].toLowerCase()).toBe("#14c8b6");
  });

  it("todos los presets generan una paleta completa sin huecos", () => {
    for (const preset of PRESETS) {
      const p = generarPaleta(preset.hex);
      for (const clave of ["--brand-500", "--mc-aqua", "--mc-aqua-rgb", "--grad-accent"]) {
        expect(p[clave], `${preset.id} → ${clave}`).toBeTruthy();
      }
    }
  });
});
