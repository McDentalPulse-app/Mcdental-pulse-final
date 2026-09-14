import { describe, it, expect } from "vitest";
import {
  tieneScoreValido,
  semaforoDeScore,
  calcularScoreEncuesta,
  getEmployeeSurveys,
  getLatestEmployeeScore,
  getEmployeeAverageScore,
  getPulseStatus,
  getEmployeeAIRisks,
  calcPulseScore,
} from "./pulseScore";

// Tests de caracterización: fijan el comportamiento actual del cálculo que alimenta
// los semáforos y la detección de riesgo. Si un refactor del payload de encuestas
// (histórico ligero vs ventana reciente) cambiara alguno de estos números, aquí se
// vería — que es justo lo que hoy fallaría en silencio.

const enc = (empleadoId, semana, score, respuestas = {}) => ({
  empleadoId,
  semana,
  score,
  respuestas,
});

describe("calcularScoreEncuesta", () => {
  const escala = (id) => ({ id, tipo: "escala" });
  const escalaConPeso = (id, peso) => ({ id, tipo: "escala", peso });
  const abierta = (id) => ({ id, tipo: "abierta" });
  const sino = (id) => ({ id, tipo: "sino" });

  it("promedia las escalas y normaliza a 0-100", () => {
    // (8 + 6) / (2 * 10) * 100 = 70
    const r = calcularScoreEncuesta([escala(1), escala(2)], { 1: 8, 2: 6 });

    expect(r.ok).toBe(true);
    expect(r.score).toBe(70);
    expect(r.semaforo).toBe("amarillo");
  });

  it("solo cuenta las preguntas de escala; ignora sino y abierta", () => {
    const preguntas = [escala(1), sino(2), abierta(3)];
    const respuestas = { 1: 9, 2: "Sí", 3: "un comentario" };

    // Solo la escala: 9 / 10 * 100 = 90. Si contara las otras, el número cambiaría.
    expect(calcularScoreEncuesta(preguntas, respuestas).score).toBe(90);
  });

  it.each([
    [10, 100, "verde"],
    [8, 80, "verde"],
    [6, 60, "amarillo"],
    [5, 50, "rojo"],
    [0, 0, "rojo"],
  ])("una escala respondida con %i da score %i (%s)", (valor, score, semaforo) => {
    const r = calcularScoreEncuesta([escala(1)], { 1: valor });

    expect(r.score).toBe(score);
    expect(r.semaforo).toBe(semaforo);
  });

  // Este era el camino real por el que entraba un score null en la base: sin preguntas
  // de escala, la fórmula dividía entre cero -> Math.round((0 / 0) * 100) === NaN, y NaN
  // se serializa a JSON como null. Además el semáforo caía en "rojo" (NaN >= 60 es falso).
  it("sin preguntas de escala NO devuelve NaN: falla explícitamente", () => {
    const r = calcularScoreEncuesta([sino(1), abierta(2)], { 1: "Sí", 2: "hola" });

    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("sin-preguntas-escala");
    expect(r.score).toBeUndefined();
  });

  it("con la lista de preguntas vacía tampoco devuelve NaN", () => {
    expect(calcularScoreEncuesta([], {}).ok).toBe(false);
  });

  it("si falta alguna respuesta de escala, no calcula un score a medias", () => {
    const r = calcularScoreEncuesta([escala(1), escala(2)], { 1: 8 });

    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("faltan-respuestas");
  });

  it("distingue 'sin preguntas de escala' de 'faltan respuestas'", () => {
    expect(calcularScoreEncuesta([sino(1)], {}).motivo).toBe("sin-preguntas-escala");
    expect(calcularScoreEncuesta([escala(1)], {}).motivo).toBe("faltan-respuestas");
  });

  it("un 0 es una respuesta válida, no una respuesta ausente", () => {
    const r = calcularScoreEncuesta([escala(1)], { 1: 0 });

    expect(r.ok).toBe(true);
    expect(r.score).toBe(0);
  });

  // Los pesos (migración 159) dejan que una pregunta cuente más que otra. La garantía que
  // hay que sostener es doble: que con todos los pesos en 1 el número NO se mueve —si no,
  // el histórico dejaría de ser comparable el día que se desplegó— y que el cálculo de aquí
  // sigue coincidiendo con el del trigger, que es quien manda.
  describe("pesos", () => {
    it("con todos los pesos en 1 da exactamente la media simple de siempre", () => {
      const sinPeso = calcularScoreEncuesta([escala(1), escala(2)], { 1: 8, 2: 6 });
      const conPeso1 = calcularScoreEncuesta(
        [escalaConPeso(1, 1), escalaConPeso(2, 1)],
        { 1: 8, 2: 6 }
      );

      expect(conPeso1.score).toBe(sinPeso.score);
      expect(conPeso1.score).toBe(70);
    });

    it("una pregunta con peso arrastra el score hacia su respuesta", () => {
      // Ponderado: (10*3 + 2*1) / (4 * 10) * 100 = 80.
      // Simple, para contraste: (10 + 2) / (2 * 10) * 100 = 60.
      const r = calcularScoreEncuesta([escalaConPeso(1, 3), escala(2)], { 1: 10, 2: 2 });

      expect(r.score).toBe(80);
      expect(calcularScoreEncuesta([escala(1), escala(2)], { 1: 10, 2: 2 }).score).toBe(60);
    });

    it("el peso no cambia nada cuando todas las respuestas son iguales", () => {
      // Un promedio ponderado de valores idénticos es ese mismo valor, pese lo que pese.
      const r = calcularScoreEncuesta([escalaConPeso(1, 5), escala(2)], { 1: 7, 2: 7 });
      expect(r.score).toBe(70);
    });

    it.each([
      ["ausente", undefined],
      ["null", null],
      ["texto", "mucho"],
      ["cero", 0],
      ["negativo", -4],
    ])("un peso %s cuenta como 1 en vez de romper el cálculo", (_, peso) => {
      const r = calcularScoreEncuesta([escalaConPeso(1, peso), escala(2)], { 1: 8, 2: 6 });

      expect(r.ok).toBe(true);
      expect(r.score).toBe(70);
    });

    it("un peso por encima del máximo se recorta a 5, no se aplica tal cual", () => {
      const recortado = calcularScoreEncuesta([escalaConPeso(1, 99), escala(2)], { 1: 10, 2: 2 });
      const alMaximo = calcularScoreEncuesta([escalaConPeso(1, 5), escala(2)], { 1: 10, 2: 2 });

      expect(recortado.score).toBe(alMaximo.score);
    });
  });

  // El score que manda es el del trigger `encuestas_calcular_score()` (migración 159), que
  // opera en `numeric` —decimal exacto— y redondea half-away-from-zero. Si el cálculo de
  // aquí no da lo mismo, la app enseña un número que la base luego cambia.
  //
  // Esto no es hipotético: la primera versión hacía `(suma / (pesoTotal * 10)) * 100`, que
  // divide en float64 ANTES de multiplicar. Con pesoTotal 8 y suma 46 el intermedio salía
  // 57.49999999999999 en vez de 57.5, y devolvía 57 donde el servidor devuelve 58.
  describe("coincide con el redondeo exacto del servidor", () => {
    // round(suma * 100 / (pesoTotal * 10)) en aritmética entera exacta, sin coma flotante.
    const scoreExacto = (suma, pesoTotal) => {
      const numerador = 2n * BigInt(suma) * 100n + BigInt(pesoTotal) * 10n;
      const denominador = 2n * BigInt(pesoTotal) * 10n;
      return Number(numerador / denominador);
    };

    it("el caso concreto que divergía: dos escalas, pesoTotal 8, suma ponderada 46", () => {
      // 10*3 + 8*2 = 46, pesos 3 y 5 -> pesoTotal 8. Exacto: 46*100/80 = 57.5 -> 58.
      const r = calcularScoreEncuesta([escalaConPeso(1, 3), escalaConPeso(2, 5)], { 1: 10, 2: 3.2 });
      expect(scoreExacto(46, 8)).toBe(58);
      expect(r.score).toBe(scoreExacto(46, 8));
    });

    it("ninguna combinación de dos escalas del núcleo diverge del cálculo exacto", () => {
      const divergencias = [];

      for (let pesoA = 1; pesoA <= 5; pesoA++) {
        for (let pesoB = 1; pesoB <= 5; pesoB++) {
          for (let valorA = 0; valorA <= 10; valorA++) {
            for (let valorB = 0; valorB <= 10; valorB++) {
              const r = calcularScoreEncuesta(
                [escalaConPeso(1, pesoA), escalaConPeso(2, pesoB)],
                { 1: valorA, 2: valorB }
              );
              const esperado = scoreExacto(valorA * pesoA + valorB * pesoB, pesoA + pesoB);
              if (r.score !== esperado) {
                divergencias.push({ pesoA, pesoB, valorA, valorB, dio: r.score, esperado });
              }
            }
          }
        }
      }

      expect(divergencias).toEqual([]);
    });
  });
});

describe("semaforoDeScore", () => {
  it.each([
    [100, "verde"],
    [80, "verde"],
    [79, "amarillo"],
    [60, "amarillo"],
    [59, "rojo"],
    [0, "rojo"],
  ])("score %i => %s", (score, esperado) => {
    expect(semaforoDeScore(score)).toBe(esperado);
  });

  it("usa los mismos umbrales que getPulseStatus (no pueden divergir)", () => {
    [0, 30, 59, 60, 79, 80, 100].forEach((score) => {
      expect(semaforoDeScore(score)).toBe(getPulseStatus(score).nivel);
    });
  });
});

describe("tieneScoreValido", () => {
  // La trampa que causó el bug: Number.isFinite(Number(x)) da true para null y para "",
  // porque ambos coercionan a 0. El predicado tiene que descartarlos ANTES de coercionar.
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["cadena vacía", ""],
    ["texto no numérico", "abc"],
    ["NaN", NaN],
  ])("rechaza %s", (_, valor) => {
    expect(tieneScoreValido(valor)).toBe(false);
  });

  it.each([
    ["cero (respuesta real, no dato ausente)", 0],
    ["un score normal", 72],
    ["el máximo", 100],
    ["un número en texto", "85"],
  ])("acepta %s", (_, valor) => {
    expect(tieneScoreValido(valor)).toBe(true);
  });
});

describe("getEmployeeSurveys", () => {
  it("filtra por empleado y ordena de la semana más reciente a la más antigua", () => {
    const encuestas = [
      enc("a", "2026-W01", 70),
      enc("b", "2026-W02", 90),
      enc("a", "2026-W03", 50),
      enc("a", "2026-W02", 60),
    ];

    expect(getEmployeeSurveys("a", encuestas).map((e) => e.semana)).toEqual([
      "2026-W03",
      "2026-W02",
      "2026-W01",
    ]);
  });

  // Regresión: `Number.isFinite(Number(e.score))` por sí solo NO descarta null ni "",
  // porque Number(null) === 0 y Number("") === 0. Esas filas se colaban como un score
  // real de 0 -> semáforo rojo -> prioridad "Crítica". Y existen: la migración de
  // Firestore escribió score: null para toda encuesta sin score
  // (scripts/migrate-firestore-to-supabase.mjs:317) y la columna es nullable.
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["cadena vacía", ""],
  ])("descarta las encuestas con score %s (no las cuenta como 0)", (_, scoreInvalido) => {
    const encuestas = [enc("a", "2026-W01", 70), enc("a", "2026-W02", scoreInvalido)];

    expect(getEmployeeSurveys("a", encuestas)).toHaveLength(1);
    // El score vigente debe ser el 70 real, no un 0 fantasma.
    expect(getLatestEmployeeScore("a", encuestas)).toBe(70);
    expect(getPulseStatus(getLatestEmployeeScore("a", encuestas)).nivel).toBe("amarillo");
  });

  it("un score de 0 SÍ es válido: es una respuesta real, no un dato ausente", () => {
    const encuestas = [enc("a", "2026-W01", 0)];

    expect(getEmployeeSurveys("a", encuestas)).toHaveLength(1);
    expect(getLatestEmployeeScore("a", encuestas)).toBe(0);
    expect(getPulseStatus(0).nivel).toBe("rojo");
  });

  it("un empleado cuya única encuesta tiene score null queda sin datos, no en rojo", () => {
    const encuestas = [enc("a", "2026-W01", null)];

    expect(getEmployeeSurveys("a", encuestas)).toEqual([]);
    expect(getLatestEmployeeScore("a", encuestas)).toBeNull();
  });

  it("devuelve vacío si el empleado no tiene encuestas", () => {
    expect(getEmployeeSurveys("z", [enc("a", "2026-W01", 70)])).toEqual([]);
  });
});

describe("getLatestEmployeeScore / getEmployeeAverageScore", () => {
  const encuestas = [
    enc("a", "2026-W01", 60),
    enc("a", "2026-W02", 90),
    enc("a", "2026-W03", 75),
  ];

  it("el último score es el de la semana más reciente, no el último del array", () => {
    expect(getLatestEmployeeScore("a", encuestas)).toBe(75);
  });

  it("el promedio usa todo el histórico del empleado", () => {
    // (60 + 90 + 75) / 3 = 75
    expect(getEmployeeAverageScore("a", encuestas)).toBe(75);
  });

  it("devuelve null si no hay datos", () => {
    expect(getLatestEmployeeScore("z", encuestas)).toBeNull();
    expect(getEmployeeAverageScore("z", encuestas)).toBeNull();
  });
});

describe("getPulseStatus — umbrales del semáforo", () => {
  it.each([
    [100, "verde"],
    [80, "verde"],
    [79, "amarillo"],
    [60, "amarillo"],
    [59, "rojo"],
    [0, "rojo"],
  ])("score %i => %s", (score, nivel) => {
    expect(getPulseStatus(score).nivel).toBe(nivel);
  });

  it("sin score es 'sin-datos', no rojo", () => {
    expect(getPulseStatus(null).nivel).toBe("sin-datos");
    expect(getPulseStatus(undefined).nivel).toBe("sin-datos");
  });
});

describe("calcPulseScore — tendencia", () => {
  it("marca ↑ cuando la última semana sube respecto a la anterior", () => {
    const encuestas = [enc("a", "2026-W01", 60), enc("a", "2026-W02", 80)];
    expect(calcPulseScore("a", encuestas).tendencia).toBe("↑");
  });

  it("marca ↓ cuando baja", () => {
    const encuestas = [enc("a", "2026-W01", 80), enc("a", "2026-W02", 60)];
    expect(calcPulseScore("a", encuestas).tendencia).toBe("↓");
  });

  it("marca → cuando se mantiene igual", () => {
    const encuestas = [enc("a", "2026-W01", 70), enc("a", "2026-W02", 70)];
    expect(calcPulseScore("a", encuestas).tendencia).toBe("→");
  });

  it("marca → con una sola encuesta (no hay con qué comparar)", () => {
    expect(calcPulseScore("a", [enc("a", "2026-W01", 70)]).tendencia).toBe("→");
  });

  it("sin encuestas devuelve sinDatos", () => {
    expect(calcPulseScore("a", []).sinDatos).toBe(true);
    expect(calcPulseScore("a", []).score).toBeNull();
  });
});

describe("getEmployeeAIRisks", () => {
  it("sin score devuelve sinDatos y riesgos nulos", () => {
    const r = getEmployeeAIRisks(null);
    expect(r.sinDatos).toBe(true);
    expect(r.renuncia).toBeNull();
  });

  it("un score alto da riesgo bajo y uno bajo da riesgo alto (monotonía)", () => {
    const bueno = getEmployeeAIRisks(95);
    const malo = getEmployeeAIRisks(20);

    expect(bueno.renuncia).toBeLessThan(malo.renuncia);
    expect(bueno.burnout).toBeLessThan(malo.burnout);
    expect(bueno.emocional).toBeLessThan(malo.emocional);
  });

  it("el score perfecto toca el suelo de cada banda de riesgo", () => {
    const r = getEmployeeAIRisks(100);
    expect(r.renuncia).toBe(5);
    expect(r.burnout).toBe(5);
    expect(r.emocional).toBe(5);
  });

  // El jsonb `respuestas` se indexa por el ID de la pregunta — en producción, un UUID.
  // El motor de riesgo lo leía con la clave numérica 9, que NO existe en los datos, así que
  // el bump de riesgo de renuncia nunca llegaba a aplicarse: la respuesta a "¿Has pensado en
  // renunciar?" se guardaba y se ignoraba. Estos tests leen por el id real de la pregunta.
  const P_RIESGO = { id: "d7d1eea0-7924-486f-aaae-ceb5a38aa20d", tipo: "opcion", area: "Riesgo" };
  const PREGUNTAS = [{ id: "7edd4569-...", tipo: "escala" }, P_RIESGO];

  it("'Sí, seriamente' sube el riesgo de renuncia 15 puntos", () => {
    const base = getEmployeeAIRisks(75, [], PREGUNTAS);
    const conRiesgo = getEmployeeAIRisks(
      75,
      [enc("a", "2026-W01", 75, { [P_RIESGO.id]: "Sí, seriamente" })],
      PREGUNTAS
    );

    expect(conRiesgo.renuncia).toBe(base.renuncia + 15);
  });

  it("'Algo' sube el riesgo de renuncia 8 puntos", () => {
    const base = getEmployeeAIRisks(75, [], PREGUNTAS);
    const conRiesgo = getEmployeeAIRisks(
      75,
      [enc("a", "2026-W01", 75, { [P_RIESGO.id]: "Algo" })],
      PREGUNTAS
    );

    expect(conRiesgo.renuncia).toBe(base.renuncia + 8);
  });

  it("'No' no sube nada", () => {
    const base = getEmployeeAIRisks(75, [], PREGUNTAS);
    const conNo = getEmployeeAIRisks(
      75,
      [enc("a", "2026-W01", 75, { [P_RIESGO.id]: "No" })],
      PREGUNTAS
    );

    expect(conNo.renuncia).toBe(base.renuncia);
  });

  it("sigue aceptando las claves legacy (9 / p9) de los datos viejos", () => {
    const porId = getEmployeeAIRisks(
      75,
      [enc("a", "2026-W01", 75, { [P_RIESGO.id]: "Sí, seriamente" })],
      PREGUNTAS
    );
    const legacy9 = getEmployeeAIRisks(75, [enc("a", "2026-W01", 75, { 9: "Sí, seriamente" })]);
    const legacyP9 = getEmployeeAIRisks(75, [enc("a", "2026-W01", 75, { p9: "Sí, seriamente" })]);

    expect(legacy9.renuncia).toBe(porId.renuncia);
    expect(legacyP9.renuncia).toBe(porId.renuncia);
  });

  it("el riesgo de renuncia nunca pasa de 95 aunque el score sea pésimo", () => {
    const r = getEmployeeAIRisks(
      0,
      [enc("a", "2026-W01", 0, { [P_RIESGO.id]: "Sí, seriamente" })],
      PREGUNTAS
    );
    expect(r.renuncia).toBeLessThanOrEqual(95);
  });

  it("solo mira la encuesta más reciente (la primera del array ya ordenado)", () => {
    const surveys = [
      enc("a", "2026-W02", 75, { [P_RIESGO.id]: "No" }),
      enc("a", "2026-W01", 75, { [P_RIESGO.id]: "Sí, seriamente" }),
    ];
    // La más reciente dice "No": no debe aplicarse el bump de la vieja.
    expect(getEmployeeAIRisks(75, surveys, PREGUNTAS).renuncia).toBe(
      getEmployeeAIRisks(75, [], PREGUNTAS).renuncia
    );
  });
});
