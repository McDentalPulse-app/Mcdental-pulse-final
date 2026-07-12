import { describe, it, expect } from "vitest";
import { isPsicologaPrincipal, getPsicologaPrincipal, formatUsuarioMensajesMeta } from "./psicologa";

// Un empleado ya no lee la tabla `usuarios` completa, sino la vista
// `usuarios_directorio` (migración 030), que NO trae el `username`. Estos tests fijan
// que encontrar a la psicóloga —de lo que depende que un empleado pueda escribirle—
// sigue funcionando sin ese campo.

const psicologa = { id: "p1", name: "LIC. ANA GORETTY SALAS", role: "psicologa", user: "ana salas" };
// Lo que ve hoy un empleado: sin `user`, porque la vista no expone el username.
const psicologaDirectorio = { id: "p1", name: "LIC. ANA GORETTY SALAS", role: "psicologa" };
const empleado = { id: "e1", name: "SANDRA GALVAN", role: "empleado" };

describe("isPsicologaPrincipal", () => {
  it("la identifica por nombre, sin necesitar el username", () => {
    expect(isPsicologaPrincipal(psicologaDirectorio)).toBe(true);
  });

  it("sigue identificándola cuando el username sí está presente", () => {
    expect(isPsicologaPrincipal(psicologa)).toBe(true);
  });

  it("ignora las tildes y el prefijo 'LIC.' al comparar el nombre", () => {
    expect(isPsicologaPrincipal({ name: "Ana Goretty Salas", role: "psicologa" })).toBe(true);
  });

  it("no confunde a alguien que no es psicóloga", () => {
    expect(isPsicologaPrincipal(empleado)).toBe(false);
    expect(isPsicologaPrincipal(null)).toBe(false);
  });
});

describe("getPsicologaPrincipal", () => {
  it("la encuentra en el directorio (sin username) — es lo que ve un empleado", () => {
    const usuarios = [empleado, psicologaDirectorio];
    expect(getPsicologaPrincipal(usuarios)?.id).toBe("p1");
  });

  it("prefiere a la principal cuando hay varias psicólogas", () => {
    const otra = { id: "p2", name: "OTRA PSICOLOGA", role: "psicologa" };
    expect(getPsicologaPrincipal([otra, psicologaDirectorio])?.id).toBe("p1");
  });

  it("si ninguna es la principal, cae a la primera psicóloga (no deja al empleado sin destinatario)", () => {
    const otra = { id: "p2", name: "OTRA PSICOLOGA", role: "psicologa" };
    expect(getPsicologaPrincipal([empleado, otra])?.id).toBe("p2");
  });

  it("devuelve null si no hay ninguna psicóloga", () => {
    expect(getPsicologaPrincipal([empleado])).toBeNull();
    expect(getPsicologaPrincipal([])).toBeNull();
  });
});

describe("formatUsuarioMensajesMeta", () => {
  it("usa 'Psicóloga' como puesto, aunque el puesto real diga otra cosa", () => {
    const meta = formatUsuarioMensajesMeta({ ...psicologaDirectorio, puesto: "Gerente RH", sucursal: "Oficina Administrativa" });
    expect(meta).toMatch(/^Psicóloga · /);
  });

  it("para el resto usa su puesto real", () => {
    const meta = formatUsuarioMensajesMeta({ ...empleado, puesto: "Recepcionista", sucursal: "McDental Palmas" });
    expect(meta).toMatch(/^Recepcionista · /);
  });

  it("sin usuario devuelve cadena vacía", () => {
    expect(formatUsuarioMensajesMeta(null)).toBe("");
  });
});
