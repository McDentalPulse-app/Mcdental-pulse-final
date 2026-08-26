import { describe, it, expect } from "vitest";
import {
  LAUNCH_WEEK,
  PRIMER_PERIODO_QUINCENAL,
  claveDePeriodo,
  claveDelPeriodo,
  esPeriodoActual,
  semanaNumero,
  semanaDesdeNumero,
  isoWeekToMonday,
} from "./constants";

/**
 * CADA CUÁNTO SE CONTESTA LA ENCUESTA. Hoy: cada SEMANA.
 *
 * Este archivo se llamaba `constants.periodoQuincenal.test.js` y fijaba lo contrario. Del 10 al
 * 16 de agosto de 2026 la encuesta fue quincenal, por un requisito mal entendido: el dueño pidió
 * que rotaran cada 15 días LAS PREGUNTAS del bloque, no que la encuesta se contestara cada 15
 * días. La rotación de bloques (`quincenaNumero`, ceil(n/2)) sigue siendo quincenal y no se
 * tocó, así que el mismo bloque sale dos semanas seguidas — eso es lo que se quiere.
 *
 * Lo que se conserva de aquel trabajo son las pruebas que NO dependían de la cadencia: el
 * emparejamiento par/impar de semanas, del que sigue colgando la rotación de bloques, y el
 * cambio de año, que es donde ese emparejamiento se rompía.
 */
describe("la encuesta se contesta cada semana", () => {
  it("cada semana es su propio período: no se agrupa con la vecina", () => {
    expect(claveDePeriodo("2026-W33")).toBe("2026-W33");
    expect(claveDePeriodo("2026-W34")).toBe("2026-W34");
    expect(claveDePeriodo("2026-W35")).toBe("2026-W35");
    expect(claveDePeriodo("2026-W34")).not.toBe(claveDePeriodo("2026-W33"));
  });

  it("las semanas anteriores al lanzamiento (pilotos legacy) se quedan igual", () => {
    expect(claveDePeriodo("2025-W15")).toBe("2025-W15");
    expect(claveDePeriodo("2026-W01")).toBe("2026-W01");
    expect(claveDePeriodo(LAUNCH_WEEK)).toBe(LAUNCH_WEEK);
  });

  it("el corte quincenal está APAGADO", () => {
    // Si un día se enciende, tiene que apuntar a la PRIMERA semana de su quincena (número impar
    // desde el lanzamiento): una segunda partiría el par por la mitad y esa quincena duraría una
    // sola semana. Es la trampa de poner esta fecha a ojo, y por eso la comprobación se queda
    // aquí en vez de borrarse con el resto.
    expect(PRIMER_PERIODO_QUINCENAL).toBe(null);
    if (PRIMER_PERIODO_QUINCENAL !== null) {
      expect(semanaNumero(PRIMER_PERIODO_QUINCENAL) % 2).toBe(1);
    }
  });

  it("la clave de un período es ella misma (idempotente)", () => {
    // Importa porque `esPeriodoActual` normaliza las dos partes antes de comparar: si esto no
    // fuera cierto, comparar una clave ya normalizada daría falso.
    for (const w of ["2026-W31", "2026-W33", "2026-W34", "2026-W40", "2025-W15"]) {
      expect(claveDePeriodo(claveDePeriodo(w))).toBe(claveDePeriodo(w));
    }
  });

  it("la clave que se escribe hoy es la que el portón reconoce", () => {
    // El desajuste que esto vigila: si la clave que se guarda no es la que el portón acepta, la
    // persona manda su encuesta y la app se la vuelve a pedir de inmediato, con el `unique`
    // rechazando el segundo envío.
    expect(esPeriodoActual(claveDelPeriodo())).toBe(true);
  });
});

describe("semanaDesdeNumero: ida y vuelta", () => {
  it("recupera la misma semana para los tres años siguientes al lanzamiento", () => {
    // La trampa que esto vigila: `getISOWeek()` lee la fecha con los getters LOCALES, mientras
    // `isoWeekToMonday()` devuelve medianoche UTC. Pasar una a la otra, en una zona al oeste de
    // Greenwich, devuelve el DOMINGO anterior y con él la semana equivocada. Por eso
    // `semanaDesdeNumero` hace su propio cálculo en UTC en vez de reusar getISOWeek.
    for (let n = 1; n <= 160; n++) {
      const semana = semanaDesdeNumero(n);
      expect(semana, `n=${n}`).toMatch(/^\d{4}-W\d{2}$/);
      expect(semanaNumero(semana), `n=${n} → ${semana}`).toBe(n);
    }
  });

  it("n=1 es la semana de lanzamiento", () => {
    expect(semanaDesdeNumero(1)).toBe(LAUNCH_WEEK);
  });

  it("devuelve null para números que no existen", () => {
    expect(semanaDesdeNumero(0)).toBe(null);
    expect(semanaDesdeNumero(-3)).toBe(null);
    expect(semanaDesdeNumero(null)).toBe(null);
  });
});

describe("el limite de año no colisiona (regresion)", () => {
  it("2026-W53 y 2027-W01 son semanas DISTINTAS", () => {
    // Con el anclaje viejo (1 de enero) las dos devolvían el lunes 2026-12-28 y `semanaNumero`
    // les daba a las dos n=27. La rotación de bloques empareja por la PARIDAD de n, así que en
    // el cambio de año se habrían emparejado las semanas equivocadas y el bloque habría saltado.
    expect(isoWeekToMonday("2026-W53").toISOString().slice(0, 10)).toBe("2026-12-28");
    expect(isoWeekToMonday("2027-W01").toISOString().slice(0, 10)).toBe("2027-01-04");
    expect(semanaNumero("2026-W53")).not.toBe(semanaNumero("2027-W01"));
  });

  it("las semanas consecutivas van de uno en uno al cruzar el año", () => {
    const n52 = semanaNumero("2026-W52");
    expect(semanaNumero("2026-W53")).toBe(n52 + 1);
    expect(semanaNumero("2027-W01")).toBe(n52 + 2);
    expect(semanaNumero("2027-W02")).toBe(n52 + 3);
  });

  it("el par de la rotación de bloques no se parte en el cambio de año", () => {
    // Ya no se mide con `claveDePeriodo` —que con la cadencia semanal no agrupa nada— sino sobre
    // la paridad, que es de lo que cuelga `quincenaNumero`. Cada semana tiene que compartir par
    // con UNA sola vecina, también al cruzar diciembre.
    const pares = ["2026-W51", "2026-W52", "2026-W53", "2027-W01", "2027-W02", "2027-W03"]
      .map((w) => Math.ceil(semanaNumero(w) / 2));
    const cuenta = {};
    pares.forEach((p) => { cuenta[p] = (cuenta[p] || 0) + 1; });
    expect(Object.values(cuenta).every((v) => v === 2)).toBe(true);
  });
});

describe("las encuestas ya guardadas no cambian de periodo", () => {
  it("las claves que existen en produccion se quedan igual", () => {
    // Las 8 primeras salieron de la base el 2026-08-06 (`select distinct semana from encuestas`);
    // W33 se añadió al revertir la cadencia, y es la única que llegó a guardarse siendo quincenal
    // — sus 76 encuestas se contestaron todas dentro de esa misma semana, así que sigue
    // significando lo mismo ahora que el período volvió a durar siete días.
    const enProduccion = [
      "2025-W15", "2026-W01", "2026-W27", "2026-W28",
      "2026-W29", "2026-W30", "2026-W31", "2026-W32", "2026-W33",
    ];
    enProduccion.forEach((w) => {
      expect(claveDePeriodo(w), `${w} no debe reagruparse`).toBe(w);
    });
  });
});
