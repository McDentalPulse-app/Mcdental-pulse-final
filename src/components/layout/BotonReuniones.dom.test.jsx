// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { navItemsPara, tieneBotonPropio } from "../../config/navItems";

/**
 * La trampa de quitar Reuniones de la barra de navegación.
 *
 * El 6 de agosto de 2026 el dueño pidió sacar «Reuniones» de la barra superior, porque ya tiene su
 * icono junto a la campana. El atajo obvio —borrar el ítem de NAV_ITEMS— habría hecho desaparecer
 * TAMBIÉN ese icono, porque `BotonReuniones` pregunta al menú del rol si debe pintarse. El ítem se
 * queda; lo que se filtra es que se pinte como enlace.
 *
 * Estas pruebas vigilan las dos mitades de esa trampa: que el ítem siga existiendo (de él dependen
 * el botón, la ruta y el buscador global) y que el botón siga apareciendo.
 */

const usuario = { id: "u1", name: "Alguien", role: "empleado" };

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: usuario }),
}));

const reuniones = [];
vi.mock("../../contexts/GlobalContext", () => ({
  useGlobal: () => ({ reuniones }),
}));

const BotonReuniones = (await import("./BotonReuniones")).default;

afterEach(cleanup);

describe("Reuniones fuera de la barra, pero con su botón", () => {
  it("el ítem SIGUE en el menú de todos los roles", () => {
    // Si alguien lo borra para sacarlo de la barra, esto falla — y con él se habrían ido en
    // silencio el icono de la cabecera, la ruta /:rol/reuniones y la entrada del buscador.
    for (const role of ["admin", "rh", "psicologa", "empleado", "doctor"]) {
      const claves = navItemsPara({ role }).map((i) => i.key);
      expect(claves, role).toContain("reuniones");
    }
  });

  it("pero está marcado para no pintarse como enlace", () => {
    expect(tieneBotonPropio({ key: "reuniones" })).toBe(true);
    expect(tieneBotonPropio({ key: "mensajes" })).toBe(true);
    // Y la marca no se pasa de lista con lo demás.
    expect(tieneBotonPropio({ key: "checador" })).toBe(false);
    expect(tieneBotonPropio({ key: "dashboard" })).toBe(false);
    expect(tieneBotonPropio(undefined)).toBe(false);
  });

  it("el botón de la cabecera se sigue pintando", () => {
    render(<MemoryRouter><BotonReuniones /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Reuniones/ })).toBeTruthy();
  });

  it("sin reuniones no lleva indicador", () => {
    render(<MemoryRouter><BotonReuniones /></MemoryRouter>);
    expect(document.querySelector(".topnav-reuniones-punto")).toBeNull();
  });

  it("con una en curso, el indicador pulsa", () => {
    reuniones.push({
      id: "r1",
      titulo: "Ahora",
      inicio: new Date(Date.now() - 5 * 60000).toISOString(),
      estado: "convocada",
    });
    render(<MemoryRouter><BotonReuniones /></MemoryRouter>);
    expect(document.querySelector(".topnav-reuniones-punto--encurso")).not.toBeNull();
    expect(screen.getByRole("button", { name: /en curso/ })).toBeTruthy();
    reuniones.length = 0;
  });
});
