import { describe, it, expect } from "vitest";
import { construirArbol, aplanar } from "./arbol";

const u = (over) => ({ id: "x", name: "X", puesto: "", jefeId: null, archivado: false, inactivo: false, ...over });

describe("construirArbol", () => {
  it("arma raíz -> hijo -> nieto (2 niveles reales)", () => {
    const jefe = u({ id: "jefe", name: "Jefa", puesto: "Directora" });
    const hijo = u({ id: "hijo", name: "Hijo", puesto: "Coordinador", jefeId: "jefe" });
    const nieto = u({ id: "nieto", name: "Nieta", puesto: "Auxiliar", jefeId: "hijo" });

    const arbol = construirArbol([jefe, hijo, nieto]);

    expect(arbol).toHaveLength(1);
    expect(arbol[0].tipo).toBe("persona");
    expect(arbol[0].persona.id).toBe("jefe");
    expect(arbol[0].hijos).toHaveLength(1);
    expect(arbol[0].hijos[0].persona.id).toBe("hijo");
    expect(arbol[0].hijos[0].hijos[0].persona.id).toBe("nieto");
  });

  it("agrupa 2+ hermanos con el mismo puesto (normalizado) en una caja de grupo", () => {
    const jefe = u({ id: "jefe", puesto: "Coordinadora" });
    const d1 = u({ id: "d1", name: "Dentista Uno", puesto: "Dentista", jefeId: "jefe" });
    const d2 = u({ id: "d2", name: "Dentista Dos", puesto: "DENTISTA ", jefeId: "jefe" }); // grafía distinta
    const recep = u({ id: "r1", name: "Sola", puesto: "Recepcionista", jefeId: "jefe" }); // sin par: persona suelta

    const [nodoJefe] = construirArbol([jefe, d1, d2, recep]);
    const grupo = nodoJefe.hijos.find((h) => h.tipo === "grupo");
    const suelta = nodoJefe.hijos.find((h) => h.tipo === "persona");

    expect(grupo.personas).toHaveLength(2);
    expect(grupo.puesto).toBe("Dentista"); // la grafía más común, no "DENTISTA"
    expect(suelta.persona.id).toBe("r1");
  });

  it("un ciclo colado (A->B->A) no cuelga: cada persona se pinta una sola vez", () => {
    const a = u({ id: "a", puesto: "A", jefeId: "b" });
    const b = u({ id: "b", puesto: "B", jefeId: "a" });

    const arbol = construirArbol([a, b]);

    // Ninguna de las dos tiene un jefe VIGENTE fuera del ciclo -> ambas son "raíz" a la vez,
    // pero cada una se pinta una sola vez (no se duplica ni cuelga el proceso).
    expect(aplanar(arbol)).toHaveLength(2);
  });

  it("descarta archivados, conserva inactivos (§9-P4: se pintan, no desaparecen)", () => {
    const jefe = u({ id: "jefe" });
    const activo = u({ id: "activo", jefeId: "jefe" });
    const deBaja = u({ id: "baja", jefeId: "jefe", inactivo: true });
    const archivado = u({ id: "archivado", jefeId: "jefe", archivado: true });

    const personas = aplanar(construirArbol([jefe, activo, deBaja, archivado]));
    const ids = personas.map((p) => p.id);

    expect(ids).toContain("activo");
    expect(ids).toContain("baja");
    expect(ids).not.toContain("archivado");
  });

  it("sin usuarios no revienta", () => {
    expect(construirArbol([])).toEqual([]);
    expect(construirArbol(undefined)).toEqual([]);
  });
});
