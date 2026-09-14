import { describe, it, expect } from "vitest";
import { normalizePregunta, normalizePreguntasList, preguntaToRow } from "./encuestaPreguntas";
import { repartirPreguntas } from "./encuestaBloques";

// Estos tests existen por un motivo concreto: normalizePregunta y preguntaToRow construyen
// objetos NUEVOS campo por campo. Una propiedad que no se enumere desaparece sin ruido — y
// una pregunta sin `bloqueId` parece del núcleo, así que sus escalas entrarían al Pulse Score
// y romperían la comparación histórica, que es de lo que viven el historial, la tendencia y
// el foco rojo por sucursal.
//
// Si alguien refactoriza esos mapeos y se lleva bloqueId por delante, estos tests avisan.

describe("bloqueId sobrevive el viaje de ida y vuelta", () => {
  it("normalizePregunta lo conserva", () => {
    const p = normalizePregunta({ id: "x", texto: "¿Qué tal?", tipo: "escala", bloqueId: "b-1" });
    expect(p.bloqueId).toBe("b-1");
  });

  it("normalizePregunta deja null a las del núcleo, no undefined", () => {
    // La diferencia importa: `!p.bloqueId` trata igual a los dos, pero un undefined que
    // viaja a la base como columna ausente no es lo mismo que un null explícito.
    const p = normalizePregunta({ id: "x", texto: "¿Qué tal?", tipo: "escala" });
    expect(p.bloqueId).toBeNull();
  });

  it("normalizePreguntasList lo conserva en toda la lista", () => {
    const lista = normalizePreguntasList([
      { id: "n", texto: "Núcleo", tipo: "escala", orden: 1 },
      { id: "b", texto: "De bloque", tipo: "escala", orden: 2, bloqueId: "b-1" },
    ]);
    expect(lista.map((p) => p.bloqueId)).toEqual([null, "b-1"]);
  });

  it("preguntaToRow lo manda a la base con el nombre de la columna", () => {
    const row = preguntaToRow({ id: "x", texto: "t", tipo: "escala", bloqueId: "b-1" });
    expect(row.bloque_id).toBe("b-1");
  });

  it("preguntaToRow manda null cuando es del núcleo", () => {
    const row = preguntaToRow({ id: "x", texto: "t", tipo: "escala" });
    expect(row.bloque_id).toBeNull();
  });

  it("tras normalizar, el reparto sigue dejando el bloque fuera del núcleo", () => {
    // La prueba de que las dos piezas encajan: es lo que impide que el score se mueva.
    const lista = normalizePreguntasList([
      { id: "n", texto: "Núcleo", tipo: "escala", orden: 1 },
      { id: "b", texto: "De bloque", tipo: "escala", orden: 2, bloqueId: "b-1" },
    ]);
    const { nucleo, delBloque } = repartirPreguntas(lista, { id: "b-1" });
    expect(nucleo.map((p) => p.id)).toEqual(["n"]);
    expect(delBloque.map((p) => p.id)).toEqual(["b"]);
  });
});

// Mismo riesgo que con bloqueId, y por el mismo motivo: si `peso` se cae de uno de estos
// mapeos, la pregunta vuelve a valer 1 en silencio y el Pulse Score deja de ser el que RH
// configuró — sin ningún error por medio.
describe("peso", () => {
  it("normalizePregunta lo conserva", () => {
    expect(normalizePregunta({ id: "x", texto: "t", tipo: "escala", peso: 3 }).peso).toBe(3);
  });

  it("una pregunta sin peso vale 1: la media simple de siempre", () => {
    expect(normalizePregunta({ id: "x", texto: "t", tipo: "escala" }).peso).toBe(1);
  });

  // Forma de objeto y `$esperado` a propósito: con la forma de array, `%i` interpola el
  // PRIMER número de la fila —la entrada— y el título acababa diciendo "un peso no numérico
  // se normaliza a NaN", que es justo lo contrario de lo que el test comprueba.
  it.each([
    { caso: "por debajo del mínimo", entrada: 0, esperado: 1 },
    { caso: "negativo", entrada: -2, esperado: 1 },
    { caso: "por encima del máximo", entrada: 99, esperado: 5 },
    { caso: "decimal", entrada: 2.4, esperado: 2 },
    { caso: "no numérico", entrada: "mucho", esperado: 1 },
    { caso: "null", entrada: null, esperado: 1 },
  ])("un peso $caso se normaliza a $esperado", ({ entrada, esperado }) => {
    expect(normalizePregunta({ id: "x", texto: "t", peso: entrada }).peso).toBe(esperado);
  });

  it("normalizePreguntasList lo conserva en toda la lista", () => {
    const lista = normalizePreguntasList([
      { id: "a", texto: "A", tipo: "escala", orden: 1, peso: 4 },
      { id: "b", texto: "B", tipo: "escala", orden: 2 },
    ]);
    expect(lista.map((p) => p.peso)).toEqual([4, 1]);
  });

  it("preguntaToRow lo manda a la base", () => {
    expect(preguntaToRow({ id: "x", texto: "t", tipo: "escala", peso: 2 }).peso).toBe(2);
  });

  it("preguntaToRow nunca manda un peso que el CHECK de la columna vaya a rechazar", () => {
    // La columna es `check (peso between 1 and 5)`: un valor fuera de rango no daría un
    // aviso en la app, daría un error crudo de Postgres al guardar.
    expect(preguntaToRow({ id: "x", texto: "t", peso: 0 }).peso).toBe(1);
    expect(preguntaToRow({ id: "x", texto: "t", peso: 12 }).peso).toBe(5);
  });
});

// Las encuestas migradas de Firestore guardaron la respuesta bajo el id numérico viejo, no
// bajo el uuid (migración 006). Si `legacyId` se pierde en el camino, el editor cree que esas
// preguntas no las ha contestado nadie y ofrece borrarlas — justo las que más histórico
// tienen detrás. El trigger de la 159 lo impide, pero después de haberlo prometido.
describe("legacyId", () => {
  it("normalizePregunta lo conserva", () => {
    expect(normalizePregunta({ id: "x", texto: "t", legacyId: 9 }).legacyId).toBe(9);
  });

  it("es null, no undefined, cuando la pregunta no lo tiene", () => {
    expect(normalizePregunta({ id: "x", texto: "t" }).legacyId).toBeNull();
  });

  it("sobrevive a normalizePreguntasList", () => {
    const lista = normalizePreguntasList([
      { id: "a", texto: "A", orden: 1, legacyId: 3 },
      { id: "b", texto: "B", orden: 2 },
    ]);
    expect(lista.map((p) => p.legacyId)).toEqual([3, null]);
  });

  it("preguntaToRow NO lo manda de vuelta a la base: lo asigna ella y es único", () => {
    expect(preguntaToRow({ id: "x", texto: "t", legacyId: 9 })).not.toHaveProperty("legacy_id");
  });

  it("preguntaToRow tampoco lo cuela con otro nombre", () => {
    expect(preguntaToRow({ id: "x", texto: "t", legacyId: 9 })).not.toHaveProperty("legacyId");
  });
});
