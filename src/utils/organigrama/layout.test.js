import { describe, it, expect } from "vitest";
import {
  calcularLayout,
  cajaDePersona,
  CAJA_ANCHO,
  CAJA_ALTO,
  SEPARACION_X,
  SEPARACION_Y,
  MARGEN,
} from "./layout";

/** Nodos con la misma forma que devuelve construirArbol(). Datos inventados, sin PII real. */
const persona = (id, hijos = []) => ({
  tipo: "persona",
  id,
  persona: { id, name: `Persona ${id}`, puesto: "Puesto" },
  hijos,
});
const grupo = (id, ids) => ({
  tipo: "grupo",
  id,
  puesto: "Dentistas",
  personas: ids.map((p) => ({ id: p, name: `Persona ${p}` })),
});

/** Expande todo lo que sea persona, en cualquier profundidad. */
const todosExpandidos = (nodos) => {
  const ids = new Set();
  const recorrer = (lista) => lista.forEach((n) => {
    ids.add(n.id);
    if (n.tipo === "persona") recorrer(n.hijos || []);
  });
  recorrer(nodos);
  return ids;
};

describe("calcularLayout", () => {
  it("un árbol vacío no rompe y no ocupa nada", () => {
    expect(calcularLayout([], new Set())).toEqual({ cajas: [], enlaces: [], ancho: 0, alto: 0 });
    expect(calcularLayout(undefined, undefined).cajas).toEqual([]);
  });

  it("coloca cada nivel más abajo que el anterior", () => {
    const arbol = [persona("a", [persona("b", [persona("c")])])];
    const { cajas } = calcularLayout(arbol, todosExpandidos(arbol));
    const y = Object.fromEntries(cajas.map((c) => [c.id, c.y]));

    expect(y.b - y.a).toBe(CAJA_ALTO + SEPARACION_Y);
    expect(y.c - y.b).toBe(CAJA_ALTO + SEPARACION_Y);
  });

  it("los hermanos no se pisan: van separados al menos el ancho de una caja", () => {
    const arbol = [persona("jefe", [persona("h1"), persona("h2"), persona("h3")])];
    const { cajas } = calcularLayout(arbol, todosExpandidos(arbol));
    const hijos = cajas.filter((c) => c.id.startsWith("h")).sort((a, b) => a.x - b.x);

    for (let i = 1; i < hijos.length; i += 1) {
      expect(hijos[i].x - hijos[i - 1].x).toBe(CAJA_ANCHO + SEPARACION_X);
      expect(hijos[i].x - hijos[i - 1].x).toBeGreaterThanOrEqual(CAJA_ANCHO);
    }
  });

  it("el padre queda centrado sobre sus hijos", () => {
    const arbol = [persona("jefe", [persona("h1"), persona("h2")])];
    const { cajas } = calcularLayout(arbol, todosExpandidos(arbol));
    const de = Object.fromEntries(cajas.map((c) => [c.id, c.x]));

    expect(de.jefe).toBe((de.h1 + de.h2) / 2);
  });

  it("una rama colapsada no aporta cajas: sus hijos no se dibujan", () => {
    const arbol = [persona("jefe", [persona("h1"), persona("h2")])];
    // Solo el jefe expandido... no: expandidos vacío = el jefe TAMPOCO despliega.
    const { cajas, enlaces } = calcularLayout(arbol, new Set());

    expect(cajas.map((c) => c.id)).toEqual(["jefe"]);
    expect(enlaces).toEqual([]);
  });

  it("hay un enlace por cada relación padre-hijo visible, y ninguno más", () => {
    const arbol = [persona("jefe", [persona("h1", [persona("n1")]), persona("h2")])];
    const { enlaces } = calcularLayout(arbol, todosExpandidos(arbol));

    expect(enlaces.map((e) => e.id).sort()).toEqual(["h1->n1", "jefe->h1", "jefe->h2"]);
  });

  it("el enlace sale del borde de abajo del padre y llega al de arriba del hijo", () => {
    const arbol = [persona("jefe", [persona("h1")])];
    const { cajas, enlaces } = calcularLayout(arbol, todosExpandidos(arbol));
    const jefe = cajas.find((c) => c.id === "jefe");
    const hijo = cajas.find((c) => c.id === "h1");
    const [e] = enlaces;

    expect(e.y1).toBe(jefe.y + CAJA_ALTO);
    expect(e.y2).toBe(hijo.y);
    expect(e.x1).toBe(jefe.x + CAJA_ANCHO / 2);
    expect(e.x2).toBe(hijo.x + CAJA_ANCHO / 2);
  });

  it("ninguna caja queda fuera del lienzo por la izquierda ni por arriba", () => {
    // Un padre con una sola rama se centra sobre ella; sin corregir el desplazamiento su x
    // podría ser negativa y esa caja quedaría fuera, inalcanzable con el scroll.
    const arbol = [persona("a", [persona("b", [persona("c")])]), persona("z")];
    const { cajas, ancho, alto } = calcularLayout(arbol, todosExpandidos(arbol));

    cajas.forEach((c) => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + CAJA_ANCHO).toBeLessThanOrEqual(ancho);
      expect(c.y + CAJA_ALTO).toBeLessThanOrEqual(alto);
    });
    expect(Math.min(...cajas.map((c) => c.x))).toBe(MARGEN);
  });

  it("un grupo es UNA caja, no una por persona", () => {
    const arbol = [persona("jefe", [grupo("g1", ["p1", "p2", "p3"])])];
    const { cajas } = calcularLayout(arbol, todosExpandidos(arbol));

    expect(cajas).toHaveLength(2);
    expect(cajas.map((c) => c.id).sort()).toEqual(["g1", "jefe"]);
  });
});

describe("cajaDePersona", () => {
  it("encuentra a alguien que es su propia caja", () => {
    const arbol = [persona("jefe", [persona("h1")])];
    const { cajas } = calcularLayout(arbol, todosExpandidos(arbol));

    expect(cajaDePersona(cajas, "h1").id).toBe("h1");
  });

  it("encuentra a alguien que está DENTRO de una caja de grupo", () => {
    const arbol = [persona("jefe", [grupo("g1", ["p1", "p2"])])];
    const { cajas } = calcularLayout(arbol, todosExpandidos(arbol));

    expect(cajaDePersona(cajas, "p2").id).toBe("g1");
  });

  it("devuelve null si no está, en vez de reventar", () => {
    expect(cajaDePersona([], "quien-sea")).toBeNull();
    expect(cajaDePersona(undefined, "quien-sea")).toBeNull();
  });
});
