import { describe, it, expect } from "vitest";
import { LAUNCH_WEEK, semanaNumero } from "./constants";
import { calcularScoreEncuesta } from "./pulseScore";
import {
  quincenaNumero,
  bloqueDeLaSemana,
  repartirPreguntas,
  preguntasDeLaSemana,
  esAreaReservada,
  preguntaTieneRespuestas,
} from "./encuestaBloques";

// Semanas reales calculadas desde el ancla, no escritas a mano: si alguien mueve
// LAUNCH_WEEK, estos tests siguen midiendo lo que dicen medir en vez de romperse por una
// razón que no tiene nada que ver con los bloques.
const semanaDelLanzamiento = (n) => {
  const [anio, wk] = LAUNCH_WEEK.split("-W").map(Number);
  const w = wk + (n - 1);
  return `${anio}-W${String(w).padStart(2, "0")}`;
};

const bloque = (id, orden, extra = {}) => ({ id, nombre: `Bloque ${id}`, orden, ...extra });

describe("quincenaNumero", () => {
  it("agrupa las semanas en pares: W1 y W2 son la misma quincena", () => {
    expect(quincenaNumero(semanaDelLanzamiento(1))).toBe(1);
    expect(quincenaNumero(semanaDelLanzamiento(2))).toBe(1);
    expect(quincenaNumero(semanaDelLanzamiento(3))).toBe(2);
    expect(quincenaNumero(semanaDelLanzamiento(4))).toBe(2);
    expect(quincenaNumero(semanaDelLanzamiento(5))).toBe(3);
  });

  it("es null antes del lanzamiento, igual que semanaNumero", () => {
    expect(semanaNumero("2020-W01")).toBeNull();
    expect(quincenaNumero("2020-W01")).toBeNull();
  });

  it("es null con una semana ilegible, en vez de reventar", () => {
    expect(quincenaNumero("")).toBeNull();
    expect(quincenaNumero(null)).toBeNull();
    expect(quincenaNumero("no-es-una-semana")).toBeNull();
  });
});

describe("bloqueDeLaSemana", () => {
  const banco = [bloque("a", 1), bloque("b", 2), bloque("c", 3), bloque("d", 4)];

  it("mantiene el mismo bloque las dos semanas de la quincena", () => {
    const s1 = bloqueDeLaSemana(semanaDelLanzamiento(1), banco);
    const s2 = bloqueDeLaSemana(semanaDelLanzamiento(2), banco);
    expect(s1.id).toBe("a");
    expect(s2.id).toBe("a");
  });

  it("cambia al pasar de quincena", () => {
    expect(bloqueDeLaSemana(semanaDelLanzamiento(3), banco).id).toBe("b");
    expect(bloqueDeLaSemana(semanaDelLanzamiento(5), banco).id).toBe("c");
    expect(bloqueDeLaSemana(semanaDelLanzamiento(7), banco).id).toBe("d");
  });

  it("vuelve al primero cuando se agota el banco", () => {
    // Q5 con 4 bloques: (5-1) % 4 = 0 -> el primero otra vez.
    expect(bloqueDeLaSemana(semanaDelLanzamiento(9), banco).id).toBe("a");
    expect(bloqueDeLaSemana(semanaDelLanzamiento(11), banco).id).toBe("b");
  });

  it("con un solo bloque, ese sale siempre", () => {
    const uno = [bloque("solo", 1)];
    expect(bloqueDeLaSemana(semanaDelLanzamiento(1), uno).id).toBe("solo");
    expect(bloqueDeLaSemana(semanaDelLanzamiento(8), uno).id).toBe("solo");
  });

  it("banco vacío devuelve null: la encuesta es solo el núcleo, y eso es correcto", () => {
    expect(bloqueDeLaSemana(semanaDelLanzamiento(1), [])).toBeNull();
    expect(bloqueDeLaSemana(semanaDelLanzamiento(1))).toBeNull();
  });

  it("ignora los bloques desactivados", () => {
    const conApagado = [bloque("a", 1, { activo: false }), bloque("b", 2)];
    // Al quedar solo "b", es el único que puede tocar en cualquier quincena.
    expect(bloqueDeLaSemana(semanaDelLanzamiento(1), conApagado).id).toBe("b");
    expect(bloqueDeLaSemana(semanaDelLanzamiento(3), conApagado).id).toBe("b");
  });

  it("respeta el orden que puso RH, no el de llegada", () => {
    const desordenado = [bloque("z", 3), bloque("x", 1), bloque("y", 2)];
    expect(bloqueDeLaSemana(semanaDelLanzamiento(1), desordenado).id).toBe("x");
    expect(bloqueDeLaSemana(semanaDelLanzamiento(3), desordenado).id).toBe("y");
    expect(bloqueDeLaSemana(semanaDelLanzamiento(5), desordenado).id).toBe("z");
  });

  it("con el mismo orden, desempata estable: no cambia de bloque al recargar", () => {
    // Sin desempate, dos bloques con orden 1 podrían quedar en cualquier posición según
    // cómo llegaran de la base, y la encuesta cambiaría de preguntas al refrescar.
    const empatados = [bloque("b", 1), bloque("a", 1)];
    const primera = bloqueDeLaSemana(semanaDelLanzamiento(1), empatados).id;
    const segunda = bloqueDeLaSemana(semanaDelLanzamiento(1), [...empatados].reverse()).id;
    expect(primera).toBe(segunda);
  });

  it("es null antes del lanzamiento aunque haya banco", () => {
    expect(bloqueDeLaSemana("2020-W01", banco)).toBeNull();
  });
});

describe("repartirPreguntas", () => {
  const nucleo1 = { id: "n1", tipo: "escala", area: "Estrés", bloqueId: null };
  const nucleo2 = { id: "n2", tipo: "opcion", area: "Riesgo", bloqueId: null };
  const deA = { id: "a1", tipo: "escala", area: "Carga extra", bloqueId: "a" };
  const deB = { id: "b1", tipo: "escala", area: "Otra", bloqueId: "b" };
  const todas = [nucleo1, nucleo2, deA, deB];

  it("el núcleo es todo lo que no tiene bloque", () => {
    const { nucleo } = repartirPreguntas(todas, bloque("a", 1));
    expect(nucleo.map((p) => p.id)).toEqual(["n1", "n2"]);
  });

  it("del bloque solo salen las del bloque activo, no las de otros", () => {
    const { delBloque } = repartirPreguntas(todas, bloque("a", 1));
    expect(delBloque.map((p) => p.id)).toEqual(["a1"]);
  });

  it("sin bloque activo, el núcleo sigue completo y no hay extras", () => {
    const { nucleo, delBloque } = repartirPreguntas(todas, null);
    expect(nucleo.map((p) => p.id)).toEqual(["n1", "n2"]);
    expect(delBloque).toEqual([]);
  });

  it("NINGUNA pregunta de bloque se cuela al núcleo: el score no se puede mover", () => {
    // Es el invariante que sostiene la comparación histórica del Pulse Score. Si esto se
    // rompe, el 87 de esta quincena deja de significar lo mismo que el 85 de la anterior.
    const { nucleo } = repartirPreguntas(todas, bloque("a", 1));
    expect(nucleo.every((p) => !p.bloqueId)).toBe(true);
  });
});

describe("preguntasDeLaSemana", () => {
  const nucleo = { id: "n1", bloqueId: null };
  const nucleoApagado = { id: "n2", bloqueId: null, activa: false };
  const deA = { id: "a1", bloqueId: "a" };
  const deAApagada = { id: "a2", bloqueId: "a", activa: false };

  it("pone el núcleo primero y el bloque después", () => {
    const lista = preguntasDeLaSemana([deA, nucleo], bloque("a", 1));
    expect(lista.map((p) => p.id)).toEqual(["n1", "a1"]);
  });

  it("deja fuera las desactivadas, sean del núcleo o del bloque", () => {
    const lista = preguntasDeLaSemana([nucleo, nucleoApagado, deA, deAApagada], bloque("a", 1));
    expect(lista.map((p) => p.id)).toEqual(["n1", "a1"]);
  });

  it("sin bloque, es la encuesta de siempre", () => {
    const lista = preguntasDeLaSemana([nucleo, deA], null);
    expect(lista.map((p) => p.id)).toEqual(["n1"]);
  });
});

describe("criterio de aceptación: un bloque no puede mover el Pulse Score", () => {
  // Es el invariante que sostiene toda la comparación histórica. Se prueba con el cálculo
  // REAL (calcularScoreEncuesta), no con una imitación, porque lo que importa es que las dos
  // piezas encajen: el reparto y la media de escalas.
  const escala = (id, bloqueId = null) => ({ id, tipo: "escala", area: id, bloqueId });

  // Núcleo: seis escalas respondidas con 8 -> media 8 -> score 80.
  const nucleo = ["n1", "n2", "n3", "n4", "n5", "n6"].map((id) => escala(id));
  // Bloque: tres escalas respondidas con 2. Si entraran al cálculo, hundirían el score.
  const delBloque = ["b1", "b2", "b3"].map((id) => escala(id, "bloque-1"));

  const respuestas = {};
  nucleo.forEach((p) => { respuestas[p.id] = 8; });
  delBloque.forEach((p) => { respuestas[p.id] = 2; });

  const bloque = { id: "bloque-1", nombre: "Carga", orden: 1 };
  const todas = [...nucleo, ...delBloque];

  it("el score con bloque es idéntico al score sin bloque", () => {
    const conBloque = calcularScoreEncuesta(repartirPreguntas(todas, bloque).nucleo, respuestas);
    const sinBloque = calcularScoreEncuesta(nucleo, respuestas);
    expect(conBloque.score).toBe(sinBloque.score);
    expect(conBloque.semaforo).toBe(sinBloque.semaforo);
  });

  it("y si el filtro NO estuviera, el score sí cambiaría: por eso hace falta", () => {
    // Este test es el que le da sentido al anterior. Sin él, "son iguales" podría ser
    // casualidad de los datos elegidos en vez de la prueba de que el filtro trabaja.
    const sinFiltrar = calcularScoreEncuesta(todas, respuestas);
    const soloNucleo = calcularScoreEncuesta(nucleo, respuestas);
    expect(sinFiltrar.score).not.toBe(soloNucleo.score);
    expect(sinFiltrar.score).toBeLessThan(soloNucleo.score);
  });

  it("las respuestas del bloque SÍ se guardan, aunque no puntúen", () => {
    // No puntuar no es lo mismo que perderse: la psicóloga tiene que poder leerlas.
    const mostradas = preguntasDeLaSemana(todas, bloque);
    expect(mostradas.map((p) => p.id)).toEqual([
      "n1", "n2", "n3", "n4", "n5", "n6", "b1", "b2", "b3",
    ]);
  });
});

describe("esAreaReservada", () => {
  it("reconoce las áreas del núcleo", () => {
    expect(esAreaReservada("Riesgo")).toBe(true);
    expect(esAreaReservada("Comentarios")).toBe(true);
    expect(esAreaReservada("Satisfacción")).toBe(true);
  });

  it("no le importan las tildes ni las mayúsculas", () => {
    // Quien escriba el área en un bloque no va a copiar la tilde exacta. "estres" tiene que
    // colisionar con "Estrés" o la guarda no sirve de nada.
    expect(esAreaReservada("estres")).toBe(true);
    expect(esAreaReservada("ESTRÉS")).toBe(true);
    expect(esAreaReservada("  motivacion  ")).toBe(true);
  });

  it("deja pasar las áreas nuevas de un bloque", () => {
    expect(esAreaReservada("Carga de trabajo")).toBe(false);
    expect(esAreaReservada("Turnos")).toBe(false);
    expect(esAreaReservada("")).toBe(false);
    expect(esAreaReservada(null)).toBe(false);
  });
});

describe("preguntaTieneRespuestas", () => {
  const encuestas = [
    { id: "e1", respuestas: { "p-vieja": 8, "p-abierta": "algo" } },
    { id: "e2", respuestas: { "p-vieja": 6 } },
  ];

  it("encuentra la pregunta que alguien contestó", () => {
    expect(preguntaTieneRespuestas("p-vieja", encuestas)).toBe(true);
    expect(preguntaTieneRespuestas("p-abierta", encuestas)).toBe(true);
  });

  it("una pregunta nueva no tiene respuestas: su texto se puede editar", () => {
    expect(preguntaTieneRespuestas("p-nueva", encuestas)).toBe(false);
  });

  it("no cuenta una respuesta vacía como respuesta", () => {
    // Una clave presente pero vacía no es un dato que haya que proteger.
    const conVacios = [{ id: "e", respuestas: { "p-x": "", "p-y": null } }];
    expect(preguntaTieneRespuestas("p-x", conVacios)).toBe(false);
    expect(preguntaTieneRespuestas("p-y", conVacios)).toBe(false);
  });

  it("aguanta encuestas con formato raro sin reventar", () => {
    // El jsonb legacy de Firestore podía venir como array posicional.
    const raras = [{ id: "e1" }, { id: "e2", respuestas: null }, { id: "e3", respuestas: [1, 2] }];
    expect(preguntaTieneRespuestas("p-x", raras)).toBe(false);
    expect(preguntaTieneRespuestas("p-x", [])).toBe(false);
    expect(preguntaTieneRespuestas(null, encuestas)).toBe(false);
  });
});
