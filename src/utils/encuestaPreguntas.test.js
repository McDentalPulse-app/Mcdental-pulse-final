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
