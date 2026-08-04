import { describe, it, expect } from "vitest";
import {
  getEncuestasEmpleado,
  formatEscalaValor,
  formatRespuestaValor,
  hasSensitiveContent,
  getComentarioAbierto,
  buildEncuestaDetalleItems,
  getEncuestaSemaforo,
  readRiesgoRenuncia,
  readProblemaPersonal,
  getPreguntaRiesgoRenuncia,
  getPreguntaAbierta,
  resumenEscalas,
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

describe("readRiesgoRenuncia", () => {
  // El jsonb `respuestas` se indexa por el ID de la pregunta — un UUID en producción.
  // Leerlo con la clave numérica 9 (lo que hacía el motor de riesgo) devolvía siempre
  // undefined: la respuesta a "¿Has pensado en renunciar?" se guardaba y se ignoraba.
  const UUID_RIESGO = "d7d1eea0-7924-486f-aaae-ceb5a38aa20d";
  const PREGS = [
    { id: "aaa", tipo: "escala", area: "Emocional" },
    { id: UUID_RIESGO, tipo: "opcion", area: "Riesgo" },
  ];

  it("lee la respuesta por el id de la pregunta, aunque sea un UUID", () => {
    const encuesta = { respuestas: { [UUID_RIESGO]: "Sí, seriamente" } };
    expect(readRiesgoRenuncia(encuesta, PREGS)).toBe("Sí, seriamente");
  });

  it("localiza la pregunta por tipo 'opcion', sin depender de su posición", () => {
    const desordenadas = [PREGS[1], PREGS[0]];
    const encuesta = { respuestas: { [UUID_RIESGO]: "Algo" } };
    expect(readRiesgoRenuncia(encuesta, desordenadas)).toBe("Algo");
  });

  it("cae a las claves legacy (9 / p9) para los datos viejos", () => {
    expect(readRiesgoRenuncia({ respuestas: { 9: "Algo" } }, [])).toBe("Algo");
    expect(readRiesgoRenuncia({ respuestas: { p9: "No" } }, [])).toBe("No");
  });

  it("devuelve null si no hay respuesta", () => {
    expect(readRiesgoRenuncia({ respuestas: {} }, PREGS)).toBeNull();
    expect(readRiesgoRenuncia(null, PREGS)).toBeNull();
  });
});

describe("resumenEscalas", () => {
  // Lo consume el prompt que se manda a la IA. Antes leía respuestas.emocional /
  // .estres / .motivacion — claves legacy que no existen en un jsonb indexado por
  // UUID, así que cada análisis salía con "emocional=undefined, estres=undefined".
  const PREGS = [
    { id: "u1", tipo: "escala", area: "Emocional" },
    { id: "u2", tipo: "escala", area: "Estrés" },
    { id: "u3", tipo: "sino", area: "Carga" },
    { id: "u4", tipo: "abierta", area: "Comentarios" },
  ];

  it("resume solo las escalas, etiquetadas por su área", () => {
    const encuesta = { respuestas: { u1: 8, u2: 6, u3: "Sí", u4: "hola" } };
    expect(resumenEscalas(encuesta, PREGS)).toBe("Emocional=8, Estrés=6");
  });

  it("nunca produce 'undefined' (que era justo el bug)", () => {
    const encuesta = { respuestas: { u1: 8 } };
    const resumen = resumenEscalas(encuesta, PREGS);

    expect(resumen).not.toMatch(/undefined/);
    expect(resumen).toBe("Emocional=8");
  });

  it("sin respuestas devuelve cadena vacía, no basura", () => {
    expect(resumenEscalas({ respuestas: {} }, PREGS)).toBe("");
    expect(resumenEscalas(null, PREGS)).toBe("");
    expect(resumenEscalas({ respuestas: { u1: 8 } }, [])).toBe("");
  });

  it("incluye el 0, que es una respuesta válida", () => {
    expect(resumenEscalas({ respuestas: { u1: 0 } }, PREGS)).toBe("Emocional=0");
  });
});

describe("readProblemaPersonal", () => {
  const UUID_PERSONAL = "723e3d9a-0156-4356-b1a0-f512db057153";
  const PREGS = [{ id: UUID_PERSONAL, tipo: "sino", area: "Personal" }];

  it("lee por el id de la pregunta de área Personal", () => {
    expect(readProblemaPersonal({ respuestas: { [UUID_PERSONAL]: "Sí" } }, PREGS)).toBe("Sí");
  });

  it("cae a la clave legacy 7", () => {
    expect(readProblemaPersonal({ respuestas: { 7: "No" } }, [])).toBe("No");
  });

  it("no confunde la pregunta de carga (también tipo sino) con la de problema personal", () => {
    const pregs = [
      { id: "carga", tipo: "sino", area: "Carga" },
      { id: UUID_PERSONAL, tipo: "sino", area: "Personal" },
    ];
    const encuesta = { respuestas: { carga: "Sí", [UUID_PERSONAL]: "No" } };
    expect(readProblemaPersonal(encuesta, pregs)).toBe("No");
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

describe("el detector no se deja robar la pregunta por un bloque rotatorio", () => {
  // Antes, ambas se localizaban como "la única de su tipo en la encuesta". Con bloques
  // rotatorios eso deja de ser cierto: el primer bloque con una pregunta de opción se
  // quedaba con el riesgo de renuncia, que es la respuesta más importante de la encuesta.
  const riesgoNucleo = { id: "n-riesgo", tipo: "opcion", area: "Riesgo", bloqueId: null };
  const abiertaNucleo = { id: "n-abierta", tipo: "abierta", area: "Comentarios", bloqueId: null };
  const opcionDeBloque = { id: "b-opcion", tipo: "opcion", area: "Turnos", bloqueId: "bloque-1" };
  const abiertaDeBloque = { id: "b-abierta", tipo: "abierta", area: "Ideas", bloqueId: "bloque-1" };

  it("elige la de riesgo del núcleo aunque el bloque vaya primero en la lista", () => {
    expect(getPreguntaRiesgoRenuncia([opcionDeBloque, riesgoNucleo]).id).toBe("n-riesgo");
  });

  it("elige la abierta del núcleo aunque el bloque tenga otra abierta antes", () => {
    expect(getPreguntaAbierta([abiertaDeBloque, abiertaNucleo]).id).toBe("n-abierta");
  });

  it("nunca elige una pregunta de bloque, ni siendo la única de su tipo", () => {
    expect(getPreguntaRiesgoRenuncia([opcionDeBloque])).toBeNull();
    expect(getPreguntaAbierta([abiertaDeBloque])).toBeNull();
  });

  it("si el área viene vacía, el respaldo por tipo sigue funcionando dentro del núcleo", () => {
    // Filas viejas pueden no tener área. El respaldo evita que el riesgo desaparezca.
    const sinArea = { id: "n-sin-area", tipo: "opcion", area: null, bloqueId: null };
    expect(getPreguntaRiesgoRenuncia([opcionDeBloque, sinArea]).id).toBe("n-sin-area");
  });

  it("lee la respuesta de la pregunta correcta cuando el bloque tiene otra de opción", () => {
    const encuesta = {
      respuestas: { "n-riesgo": "Sí, seriamente", "b-opcion": "Turno de mañana" },
    };
    expect(readRiesgoRenuncia(encuesta, [opcionDeBloque, riesgoNucleo])).toBe("Sí, seriamente");
  });

  it("sigue funcionando con preguntas que no traen el campo bloqueId", () => {
    // Todo el código que ya existía pasa preguntas sin ese campo.
    const viejas = [
      { id: "v1", tipo: "opcion", area: "Riesgo" },
      { id: "v2", tipo: "abierta", area: "Comentarios" },
    ];
    expect(getPreguntaRiesgoRenuncia(viejas).id).toBe("v1");
    expect(getPreguntaAbierta(viejas).id).toBe("v2");
  });
});

describe("fase 5: las respuestas de un bloque se leen en el detalle", () => {
  // El bloque no puntúa, pero eso NO significa que se pierda: la psicóloga tiene que poder
  // leerlo en el expediente. Y las de bloques ya apagados también, o el histórico se queda
  // con "Pregunta registrada" sin texto.
  const nucleoEscala = { id: "n-esc", tipo: "escala", area: "Estrés", bloqueId: null };
  const nucleoRiesgo = { id: "n-rie", tipo: "opcion", area: "Riesgo", bloqueId: null,
                         opciones: ["No", "Algo", "Sí, seriamente"] };
  const deBloque = { id: "b-esc", tipo: "escala", area: "Volumen quincenal", bloqueId: "b-1" };
  const deBloqueViejo = { id: "b-old", tipo: "escala", area: "Turnos", bloqueId: "b-0" };

  const encuesta = {
    id: "e1",
    semana: "2026-W05",
    respuestas: { "n-esc": 8, "n-rie": "No", "b-esc": 3, "b-old": 6 },
  };

  it("la respuesta del bloque aparece con su texto y su área", () => {
    const items = buildEncuestaDetalleItems(encuesta, [nucleoEscala, nucleoRiesgo, deBloque]);
    const delBloque = items.find((i) => i.area === "Volumen quincenal");
    expect(delBloque).toBeDefined();
    expect(delBloque.valor).toBe(3);
  });

  it("el núcleo y el bloque conviven en el mismo detalle", () => {
    const items = buildEncuestaDetalleItems(encuesta, [nucleoEscala, nucleoRiesgo, deBloque]);
    expect(items.map((i) => i.area)).toContain("Estrés");
    expect(items.map((i) => i.area)).toContain("Volumen quincenal");
  });

  it("una respuesta de un bloque ya apagado sigue teniendo texto, no queda huérfana", () => {
    // Este es el motivo de que getEncuestaPreguntas traiga también las inactivas: si al
    // detalle solo llegaran las preguntas del periodo actual, las de quincenas pasadas
    // caerían al respaldo genérico y saldrían sin su enunciado.
    const items = buildEncuestaDetalleItems(encuesta, [nucleoEscala, deBloque, deBloqueViejo]);
    const vieja = items.find((i) => i.area === "Turnos");
    expect(vieja).toBeDefined();
    expect(vieja.pregunta).not.toBe("Pregunta registrada");
    expect(vieja.valor).toBe(6);
  });

  it("el riesgo de renuncia se sigue leyendo con un bloque en medio", () => {
    expect(readRiesgoRenuncia(encuesta, [deBloque, nucleoRiesgo, nucleoEscala])).toBe("No");
  });

  it("el resumen que va a la IA deja fuera las escalas del bloque", () => {
    // Decisión del 2026-07-29: un área que aparece una quincena y desaparece la siguiente
    // haría que la IA leyera un cambio donde solo hubo un cambio de cuestionario.
    const resumen = resumenEscalas(encuesta, [nucleoEscala, deBloque, deBloqueViejo]);
    expect(resumen).toContain("Estrés");
    expect(resumen).not.toContain("Volumen quincenal");
    expect(resumen).not.toContain("Turnos");
  });
});

describe("preguntas abiertas de bloque: cada una es la suya", () => {
  // El fallo del 2026-08-04: en el detalle salía la misma respuesta repetida cuatro veces.
  // Producción tiene 22 preguntas activas y CUATRO de tipo abierta — la del núcleo más una
  // por cada bloque rotatorio. `buildAbiertaItem` ponía a todas el enunciado de la del núcleo
  // y, si no tenían respuesta propia, también su comentario. Cuatro filas idénticas.
  const nucleoAbierta = {
    id: "n-abi", tipo: "abierta", area: "Comentarios", bloqueId: null,
    texto: "¿Quieres compartir algo más con el equipo de bienestar?",
  };
  const abiertaBloqueA = {
    id: "b-abi-a", tipo: "abierta", area: "Ideas de comunicación", bloqueId: "b-1",
    texto: "¿Qué cambiarías de cómo se comunican las cosas en tu sucursal?",
  };
  const abiertaBloqueB = {
    id: "b-abi-b", tipo: "abierta", area: "Capacitación", bloqueId: "b-2",
    texto: "¿Hay algo que te gustaría aprender?",
  };
  const abiertaBloqueC = {
    id: "b-abi-c", tipo: "abierta", area: "Situación a comentar", bloqueId: "b-3",
    texto: "¿Viviste alguna situación con un paciente que quieras comentar?",
  };
  const todas = [nucleoAbierta, abiertaBloqueA, abiertaBloqueB, abiertaBloqueC];

  it("el comentario del núcleo NO se repite en las abiertas de los bloques", () => {
    // El caso exacto de producción: solo se contestó la del núcleo.
    const encuesta = { id: "e1", respuestas: { "n-abi": "Todo bien esta semana." } };
    const items = buildEncuestaDetalleItems(encuesta, todas);

    const conEseTexto = items.filter((i) => i.valor === "Todo bien esta semana.");
    expect(conEseTexto).toHaveLength(1);
    expect(items.filter((i) => i.esAbierta)).toHaveLength(1);
  });

  it("dos abiertas contestadas salen cada una con SU enunciado y SU respuesta", () => {
    const encuesta = {
      id: "e2",
      respuestas: { "n-abi": "Sin novedad.", "b-abi-a": "Que avisen los cambios de turno antes." },
    };
    const items = buildEncuestaDetalleItems(encuesta, todas);

    const delBloque = items.find((i) => i.area === "Ideas de comunicación");
    expect(delBloque).toBeDefined();
    expect(delBloque.pregunta).toBe(abiertaBloqueA.texto);
    expect(delBloque.valor).toBe("Que avisen los cambios de turno antes.");

    const delNucleo = items.find((i) => i.area === "Comentarios");
    expect(delNucleo.pregunta).toBe(nucleoAbierta.texto);
    expect(delNucleo.valor).toBe("Sin novedad.");
  });

  it("una abierta de bloque sin contestar no se pinta", () => {
    const encuesta = { id: "e3", respuestas: { "b-abi-a": "Algo que decir." } };
    const items = buildEncuestaDetalleItems(encuesta, todas);
    expect(items.find((i) => i.area === "Capacitación")).toBeUndefined();
    expect(items.find((i) => i.area === "Situación a comentar")).toBeUndefined();
  });

  it("el comentario del núcleo sigue apareciendo aunque nadie lo conteste", () => {
    // Garantía que ya existía: la pregunta abierta del núcleo se muestra siempre, con
    // "Sin respuesta.", porque su ausencia también dice algo.
    const items = buildEncuestaDetalleItems({ id: "e4", respuestas: {} }, todas);
    const abiertas = items.filter((i) => i.esAbierta);
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0].display).toBe("Sin respuesta.");
  });

  it("sigue leyendo el comentario de los campos sueltos antiguos", () => {
    // Filas viejas guardaban el comentario fuera de `respuestas`. Ese respaldo es solo
    // para la abierta del núcleo, no para las de bloque.
    const encuesta = { id: "e5", comentarioAbierto: "Comentario de una fila vieja.", respuestas: {} };
    const items = buildEncuestaDetalleItems(encuesta, todas);
    const abiertas = items.filter((i) => i.esAbierta);
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0].valor).toBe("Comentario de una fila vieja.");
  });
});
