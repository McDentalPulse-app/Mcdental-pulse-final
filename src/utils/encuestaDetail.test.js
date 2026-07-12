import { describe, it, expect } from "vitest";
import {
  getEncuestasEmpleado,
  formatEscalaValor,
  formatRespuestaValor,
  hasSensitiveContent,
  getComentarioAbierto,
  buildEncuestaDetalleItems,
  getEncuestaSemaforo,
} from "./encuestaDetail";

// El jsonb `respuestas` convive en DOS formatos: objeto indexado por id de pregunta
// (formato actual) y array posicional (legacy de Firestore). Estos tests fijan que
// ambos se siguen leyendo — es la parte del modelo que un refactor del payload de
// encuestas tocaría de lleno.

const PREGUNTAS = [
  { id: 1, texto: "¿Cómo describes tu estado emocional?", tipo: "escala", area: "Emocional" },
  { id: 6, texto: "¿Tu carga es manejable?", tipo: "sino", area: "Carga" },
  { id: 9, texto: "¿Has pensado en renunciar?", tipo: "opcion", area: "Riesgo" },
  { id: 10, texto: "¿Algo más?", tipo: "abierta", area: "Comentarios" },
];

describe("getEncuestasEmpleado", () => {
  it("filtra por empleado y ordena de la semana más reciente a la más antigua", () => {
    const encuestas = [
      { empleadoId: "a", semana: "2026-W01" },
      { empleadoId: "b", semana: "2026-W05" },
      { empleadoId: "a", semana: "2026-W03" },
    ];

    expect(getEncuestasEmpleado(encuestas, "a").map((e) => e.semana)).toEqual([
      "2026-W03",
      "2026-W01",
    ]);
  });

  it("tolera una lista vacía o indefinida", () => {
    expect(getEncuestasEmpleado(undefined, "a")).toEqual([]);
  });
});

describe("formatEscalaValor", () => {
  it.each([
    [10, "10 · Muy alto"],
    [9, "9 · Muy alto"],
    [7, "7 · Alto"],
    [5, "5 · Moderado"],
    [3, "3 · Bajo"],
    [1, "1 · Muy bajo"],
  ])("%i => %s", (valor, esperado) => {
    expect(formatEscalaValor(valor)).toBe(esperado);
  });
});

describe("formatRespuestaValor", () => {
  it("usa la etiqueta de escala solo para preguntas de tipo escala", () => {
    expect(formatRespuestaValor({ tipo: "escala" }, 8)).toBe("8 · Alto");
    expect(formatRespuestaValor({ tipo: "sino" }, "Sí")).toBe("Sí");
  });

  it("un valor vacío se muestra como guion", () => {
    expect(formatRespuestaValor({ tipo: "escala" }, null)).toBe("—");
    expect(formatRespuestaValor({ tipo: "sino" }, "  ")).toBe("—");
  });
});

describe("hasSensitiveContent", () => {
  it("detecta palabras sensibles sin importar mayúsculas", () => {
    expect(hasSensitiveContent("Estoy pensando en mi RENUNCIA")).toBe(true);
    expect(hasSensitiveContent("hay acoso en la sucursal")).toBe(true);
  });

  it("no marca texto neutro", () => {
    expect(hasSensitiveContent("Todo bien, gracias")).toBe(false);
    expect(hasSensitiveContent("")).toBe(false);
    expect(hasSensitiveContent(null)).toBe(false);
  });
});

describe("getComentarioAbierto", () => {
  it("lee el comentario por el id de la pregunta abierta", () => {
    const encuesta = { respuestas: { 10: "Me siento agotada" } };
    expect(getComentarioAbierto(encuesta, PREGUNTAS)).toBe("Me siento agotada");
  });

  it("cae a las claves legacy cuando no hay pregunta abierta que empate", () => {
    const encuesta = { respuestas: { comentarioAbierto: "Comentario viejo" } };
    expect(getComentarioAbierto(encuesta, [])).toBe("Comentario viejo");
  });

  it("devuelve vacío si no hay comentario", () => {
    expect(getComentarioAbierto({ respuestas: {} }, PREGUNTAS)).toBe("");
  });
});

describe("buildEncuestaDetalleItems", () => {
  it("sin encuesta devuelve una lista vacía", () => {
    expect(buildEncuestaDetalleItems(null, PREGUNTAS)).toEqual([]);
  });

  it("construye un item por respuesta con el formato de su tipo", () => {
    const encuesta = { respuestas: { 1: 8, 6: "Sí", 9: "No", 10: "Todo bien" } };
    const items = buildEncuestaDetalleItems(encuesta, PREGUNTAS);

    const escala = items.find((i) => i.tipo === "escala");
    expect(escala.display).toBe("8 · Alto");
    expect(escala.area).toBe("Emocional");

    const abierta = items.find((i) => i.esAbierta);
    expect(abierta.valor).toBe("Todo bien");
  });

  it("marca para revisar la respuesta abierta con contenido sensible", () => {
    const encuesta = { respuestas: { 10: "Tengo mucha ansiedad" } };
    const items = buildEncuestaDetalleItems(encuesta, PREGUNTAS);

    expect(items.find((i) => i.esAbierta).revisar).toBe(true);
  });

  it("siempre incluye un item de pregunta abierta, aunque no se haya respondido", () => {
    const encuesta = { respuestas: { 1: 7 } };
    const items = buildEncuestaDetalleItems(encuesta, PREGUNTAS);

    const abierta = items.find((i) => i.esAbierta);
    expect(abierta).toBeDefined();
    expect(abierta.display).toBe("Sin respuesta.");
    expect(abierta.valor).toBeNull();
  });

  it("lee el formato legacy en el que respuestas es un array posicional", () => {
    // Sin preguntas, el array se recorre por posición (1-indexado en la salida).
    const encuesta = { respuestas: [9, "Sí"] };
    const items = buildEncuestaDetalleItems(encuesta, []);

    expect(items[0].numero).toBe(1);
    expect(items[0].valor).toBe(9);
    expect(items[1].valor).toBe("Sí");
  });

  it("etiqueta las claves legacy con nombre (emocional, estres...) en vez de ignorarlas", () => {
    const encuesta = { respuestas: { emocional: 6, estres: 8 } };
    const items = buildEncuestaDetalleItems(encuesta, []);

    expect(items.map((i) => i.pregunta)).toContain("Estado emocional");
    expect(items.map((i) => i.pregunta)).toContain("Estrés");
  });

  it("omite las respuestas vacías", () => {
    const encuesta = { respuestas: { 1: 8, 6: "", 9: null } };
    const items = buildEncuestaDetalleItems(encuesta, PREGUNTAS);

    expect(items.filter((i) => !i.esAbierta)).toHaveLength(1);
  });
});

describe("getEncuestaSemaforo", () => {
  it("prefiere el semáforo persistido en la encuesta", () => {
    expect(getEncuestaSemaforo({ semaforo: "Rojo", score: 95 })).toBe("rojo");
  });

  it("si no hay semáforo, lo deriva del score con los umbrales 80/60", () => {
    expect(getEncuestaSemaforo({ score: 85 })).toBe("verde");
    expect(getEncuestaSemaforo({ score: 70 })).toBe("amarillo");
    expect(getEncuestaSemaforo({ score: 40 })).toBe("rojo");
  });

  it("sin semáforo ni score válido cae a verde (comportamiento actual)", () => {
    expect(getEncuestaSemaforo({})).toBe("verde");
  });
});
