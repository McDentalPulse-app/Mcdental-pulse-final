import { describe, it, expect } from "vitest";
import { TABS_MOVIL } from "./navItems";

/**
 * Checador al centro (círculo elevado, Sidebar.jsx) libera un hueco que se le da a Mensajes en
 * los 4 roles que sí lo tienen. Admin/admin_plus no tienen checador y Mensajes se les queda
 * flotante (Navegacion.jsx lee este mismo TABS_MOVIL para decidirlo) — si alguien agrega
 * "checador" o "mensajes" a uno sin el otro en esos 4 roles, o al revés en admin, el layout
 * queda a medias sin que ningún test lo note. Esto lo nota.
 */
describe("TABS_MOVIL — checador al centro trae mensajes con él", () => {
  const rolesConChecador = ["psicologa", "rh", "empleado", "doctor"];
  const rolesSinChecador = ["admin", "admin_plus"];

  it.each(rolesConChecador)("%s: tiene checador Y mensajes", (rol) => {
    expect(TABS_MOVIL[rol]).toContain("checador");
    expect(TABS_MOVIL[rol]).toContain("mensajes");
  });

  it.each(rolesSinChecador)("%s: sin checador, sin mensajes (se queda flotante)", (rol) => {
    expect(TABS_MOVIL[rol]).not.toContain("checador");
    expect(TABS_MOVIL[rol]).not.toContain("mensajes");
  });

  it("ningún rol tiene más de 5 tabs (4 + el central)", () => {
    for (const claves of Object.values(TABS_MOVIL)) {
      expect(claves.length).toBeLessThanOrEqual(5);
    }
  });
});
