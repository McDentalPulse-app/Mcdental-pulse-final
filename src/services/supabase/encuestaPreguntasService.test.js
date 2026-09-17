import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * El viaje de ida y vuelta de una pregunta entre la app y la base.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO, y por qué es el primero de `src/services/`. Los campos de
 * una pregunta (`peso`, `invertida`, `bloqueId`) pasan por CINCO mapeos entre el objeto que
 * maneja la app y la fila que guarda Postgres. Tres de esos mapeos los vigilaban los tests
 * de `encuestaPreguntas.js`; los otros dos —el `toRow`/`fromRow` de este servicio y el
 * `getEncuestaPreguntas` de usuariosService— no los vigilaba NADA: borrarlos dejaba los 682
 * tests en verde.
 *
 * Y no es una pérdida benigna. Si `invertida` se cae en la escritura, RH marca una pregunta
 * y la marca no llega; si se cae en la lectura, la base sigue invirtiendo (la columna está
 * ahí) mientras la pantalla calcula al derecho — el cliente enseña un número y el servidor
 * guarda otro, que es justo la divergencia que el resto del código se esfuerza en evitar.
 * Sin un solo error a la vista en ninguno de los dos casos.
 *
 * Se prueban juntos los dos extremos del mismo viaje aunque vivan en ficheros distintos:
 * separarlos escondería que lo que importa es que la ida y la vuelta CASEN.
 */

// El builder de supabase encadena y se resuelve al final. Aquí cada método devuelve el
// propio objeto salvo el último de cada cadena, que devuelve {data, error} — y `await`
// sobre un objeto plano lo entrega tal cual, así que no hace falta simular thenables.
const llamadas = { upsert: [], insert: [], select: [] };
let respuestaFilas = [];

const tabla = () => {
  const api = {
    upsert: (rows) => {
      llamadas.upsert.push(rows);
      return { select: () => ({ data: respuestaFilas, error: null }) };
    },
    insert: (rows) => {
      llamadas.insert.push(rows);
      return { select: () => ({ data: respuestaFilas, error: null }) };
    },
    select: (cols) => {
      llamadas.select.push(cols);
      return { order: () => ({ data: respuestaFilas, error: null }) };
    },
  };
  return api;
};

vi.mock("../../config/supabase", () => ({
  supabase: { from: () => tabla() },
}));

const { saveEncuestaPreguntas } = await import("./encuestaPreguntasService");
const { getEncuestaPreguntas } = await import("./usuariosService");

/** Una fila tal y como la devuelve Postgres. */
const fila = (extra = {}) => ({
  id: "uuid-1",
  legacy_id: 3,
  texto: "¿Qué tal?",
  tipo: "escala",
  area: "Ambiente de equipo",
  opciones: null,
  orden: 1,
  activa: true,
  bloque_id: null,
  peso: 1,
  invertida: false,
  ...extra,
});

/** La misma fila, pero como la devolvería una base que todavía no tiene la migración 160. */
const filaSinInvertida = () => {
  const f = fila();
  delete f.invertida;
  return f;
};

beforeEach(() => {
  llamadas.upsert = [];
  llamadas.insert = [];
  llamadas.select = [];
  respuestaFilas = [fila()];
});

describe("lo que se MANDA a la base al guardar", () => {
  it("una pregunta marcada invertida viaja marcada", async () => {
    await saveEncuestaPreguntas([
      { id: "uuid-1", texto: "t", tipo: "escala", orden: 1, invertida: true, peso: 3 },
    ]);

    const [enviada] = llamadas.upsert[0];
    expect(enviada.invertida).toBe(true);
    expect(enviada.peso).toBe(3);
  });

  it("una sin marcar viaja como NO invertida, nunca como undefined", async () => {
    // Un undefined no es lo mismo que un false: PostgREST omitiría la columna y la fila se
    // quedaría con lo que tuviera antes, así que desmarcar una pregunta no haría nada.
    await saveEncuestaPreguntas([{ id: "uuid-1", texto: "t", tipo: "escala", orden: 1 }]);

    const [enviada] = llamadas.upsert[0];
    expect(enviada.invertida).toBe(false);
    expect(Object.hasOwn(enviada, "invertida")).toBe(true);
  });

  it("una pregunta NUEVA (id numérico) también lleva su dirección", async () => {
    // Las nuevas van por `insert`, no por `upsert`: es otra rama del servicio y podría
    // perder el campo por su cuenta.
    await saveEncuestaPreguntas([
      { id: 1735000000000, texto: "nueva", tipo: "escala", orden: 9, invertida: true },
    ]);

    expect(llamadas.upsert).toHaveLength(0);
    const [enviada] = llamadas.insert[0];
    expect(enviada.invertida).toBe(true);
    expect(enviada.id).toBeUndefined(); // la asigna la base
  });

  it("NO manda legacy_id: lo asigna la base y es único", async () => {
    await saveEncuestaPreguntas([
      { id: "uuid-1", texto: "t", tipo: "escala", orden: 1, legacyId: 3 },
    ]);

    expect(Object.hasOwn(llamadas.upsert[0][0], "legacy_id")).toBe(false);
  });
});

describe("lo que se LEE de la base", () => {
  it("saveEncuestaPreguntas devuelve la dirección que guardó la base", async () => {
    respuestaFilas = [fila({ invertida: true, peso: 4 })];

    const [vuelta] = await saveEncuestaPreguntas([
      { id: "uuid-1", texto: "t", tipo: "escala", orden: 1, invertida: true },
    ]);

    expect(vuelta.invertida).toBe(true);
    expect(vuelta.peso).toBe(4);
    expect(vuelta.legacyId).toBe(3);
  });

  it("getEncuestaPreguntas trae dirección, peso y legacyId", async () => {
    respuestaFilas = [fila({ invertida: true, peso: 5, legacy_id: 9 })];

    const [leida] = await getEncuestaPreguntas();

    expect(leida.invertida).toBe(true);
    expect(leida.peso).toBe(5);
    expect(leida.legacyId).toBe(9);
    expect(leida.bloqueId).toBeNull();
  });

  it("una base SIN la migración 160 se lee como «no invertida», nunca al revés", async () => {
    // La columna no existe todavía -> la fila llega sin el campo. Leerlo como invertida
    // pondría del revés el score de toda la plantilla, así que solo un true literal cuenta.
    respuestaFilas = [filaSinInvertida()];

    const [leida] = await getEncuestaPreguntas();
    expect(leida.invertida).toBe(false);
  });

  it("lo mismo en la vuelta del guardado", async () => {
    respuestaFilas = [filaSinInvertida()];

    const [vuelta] = await saveEncuestaPreguntas([
      { id: "uuid-1", texto: "t", tipo: "escala", orden: 1 },
    ]);
    expect(vuelta.invertida).toBe(false);
  });
});

describe("ida y vuelta completas", () => {
  it("lo que se manda marcado vuelve marcado: el viaje no pierde la dirección", async () => {
    respuestaFilas = [fila({ invertida: true })];

    const [vuelta] = await saveEncuestaPreguntas([
      { id: "uuid-1", texto: "t", tipo: "escala", orden: 1, invertida: true },
    ]);

    expect(llamadas.upsert[0][0].invertida).toBe(true);
    expect(vuelta.invertida).toBe(true);
  });
});
