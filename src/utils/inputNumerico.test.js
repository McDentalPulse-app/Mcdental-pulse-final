import { describe, it, expect, vi } from "vitest";
import { bloquearNotacionCientifica } from "./inputNumerico";

describe("bloquearNotacionCientifica", () => {
  it("bloquea e, E y +", () => {
    for (const key of ["e", "E", "+"]) {
      const e = { key, preventDefault: vi.fn() };
      bloquearNotacionCientifica(e);
      expect(e.preventDefault).toHaveBeenCalled();
    }
  });

  it("deja pasar dígitos, punto y guion", () => {
    for (const key of ["5", ".", "-", "Backspace"]) {
      const e = { key, preventDefault: vi.fn() };
      bloquearNotacionCientifica(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
  });
});
