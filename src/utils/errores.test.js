import { describe, it, expect } from "vitest";
import { motivoFallo, mensajeDeFallo } from "./errores";

describe("motivoFallo", () => {
  it("devuelve el motivo del servidor tal cual", () => {
    // El caso que motivó todo esto: la pantalla decía "revisa la conexión" mientras
    // /api/gemini contestaba un 413 con este texto.
    const e = new Error("El prompt es demasiado largo.");
    expect(motivoFallo(e)).toBe("El prompt es demasiado largo.");
  });

  it("respeta los motivos de permisos, que son los que RLS y las edge functions devuelven", () => {
    expect(motivoFallo(new Error("No tienes permiso para cambiar nombres de usuario.")))
      .toBe("No tienes permiso para cambiar nombres de usuario.");
  });

  it("cae al genérico cuando de verdad no hay red", () => {
    // `fetch` rechazado: aquí el mensaje del navegador no le dice nada a nadie y el
    // texto sobre la conexión SÍ es el correcto.
    for (const txt of ["Failed to fetch", "NetworkError when attempting to fetch resource", "Load failed"]) {
      expect(motivoFallo(new Error(txt))).toBe("Revisa la conexión e inténtalo de nuevo.");
    }
  });

  it("cae al genérico si no hay mensaje aprovechable", () => {
    expect(motivoFallo(undefined)).toBe("Revisa la conexión e inténtalo de nuevo.");
    expect(motivoFallo(null)).toBe("Revisa la conexión e inténtalo de nuevo.");
    expect(motivoFallo(new Error(""))).toBe("Revisa la conexión e inténtalo de nuevo.");
    expect(motivoFallo(new Error("   "))).toBe("Revisa la conexión e inténtalo de nuevo.");
  });

  it("acepta una cadena suelta, no solo un Error", () => {
    expect(motivoFallo("Sesión inválida.")).toBe("Sesión inválida.");
  });

  it("permite cambiar el genérico", () => {
    expect(motivoFallo(new Error("Failed to fetch"), "Sin conexión.")).toBe("Sin conexión.");
  });
});

describe("mensajeDeFallo", () => {
  it("une el encabezado propio con el motivo real", () => {
    expect(mensajeDeFallo("No se pudo guardar el permiso.", new Error("No autorizado.")))
      .toBe("No se pudo guardar el permiso. No autorizado.");
  });

  it("une el encabezado con el genérico cuando no hay red", () => {
    expect(mensajeDeFallo("No se pudo guardar el permiso.", new Error("Failed to fetch")))
      .toBe("No se pudo guardar el permiso. Revisa la conexión e inténtalo de nuevo.");
  });
});
