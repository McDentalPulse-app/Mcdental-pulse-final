import { describe, it, expect } from "vitest";
import {
  ANTES_MIN,
  DESPUES_MIN,
  enCurso,
  esHoyMasTarde,
  estadoParaElIcono,
} from "./reuniones";

const MIN = 60000;
const AHORA = new Date("2026-08-06T18:00:00Z").getTime();

/**
 * Una reunión que empieza `desplazamientoMin` minutos respecto a AHORA.
 * POSITIVO = en el futuro (aún no empieza) · NEGATIVO = ya empezó hace ese rato.
 */
const reunion = (desplazamientoMin, extra = {}) => ({
  id: String(desplazamientoMin),
  titulo: "Reunión",
  inicio: new Date(AHORA + desplazamientoMin * MIN).toISOString(),
  estado: "convocada",
  ...extra,
});

describe("enCurso: la misma ventana que habilita el botón «Entrar»", () => {
  it("se puede entrar desde 15 minutos ANTES de la hora, no antes", () => {
    expect(enCurso(reunion(ANTES_MIN), AHORA)).toBe(true);       // empieza en 15 min
    expect(enCurso(reunion(ANTES_MIN + 1), AHORA)).toBe(false);  // empieza en 16 min
  });

  it("sigue abierta hasta 120 minutos después de empezar", () => {
    expect(enCurso(reunion(-DESPUES_MIN), AHORA)).toBe(true);
    expect(enCurso(reunion(-DESPUES_MIN - 1), AHORA)).toBe(false);
  });

  it("una cancelada nunca está en curso, ni a su hora", () => {
    expect(enCurso(reunion(0, { estado: "cancelada" }), AHORA)).toBe(false);
  });

  it("no revienta con datos incompletos", () => {
    expect(enCurso(null, AHORA)).toBe(false);
    expect(enCurso(undefined, AHORA)).toBe(false);
    expect(enCurso({}, AHORA)).toBe(false);
    expect(enCurso({ inicio: "mañana por la tarde" }, AHORA)).toBe(false);
  });

  it("no depende de `fin`, que en producción viene vacío", () => {
    // Las dos reuniones que existen hoy tienen fin = null. Si la regla mirara `fin`, no habría
    // forma de saber si están abiertas.
    expect(enCurso({ ...reunion(0), fin: null }, AHORA)).toBe(true);
    // Y un `fin` que ya pasó no la cierra antes de tiempo: la ventana la manda el inicio.
    expect(enCurso({ ...reunion(-30), fin: new Date(AHORA - 10 * MIN).toISOString() }, AHORA)).toBe(true);
  });
});

describe("esHoyMasTarde", () => {
  it("sí para una de más tarde del mismo día", () => {
    // AHORA es mediodía UTC, así que +4 h sigue siendo el mismo día en México (UTC-6).
    expect(esHoyMasTarde(reunion(240), AHORA)).toBe(true);
  });

  it("no para una que ya empezó, aunque sea de hoy", () => {
    expect(esHoyMasTarde(reunion(-1), AHORA)).toBe(false);
    expect(esHoyMasTarde(reunion(0), AHORA)).toBe(false);
  });

  it("no para una de otro día", () => {
    expect(esHoyMasTarde(reunion(60 * 24), AHORA)).toBe(false);
    expect(esHoyMasTarde(reunion(-60 * 24), AHORA)).toBe(false);
  });

  it("una cancelada de hoy no cuenta", () => {
    expect(esHoyMasTarde(reunion(240, { estado: "cancelada" }), AHORA)).toBe(false);
  });
});

describe("estadoParaElIcono", () => {
  it("apagado si no hay nada", () => {
    expect(estadoParaElIcono([], AHORA)).toBe(null);
    expect(estadoParaElIcono(null, AHORA)).toBe(null);
    expect(estadoParaElIcono(undefined, AHORA)).toBe(null);
  });

  it("«en_curso» cuando hay una abierta ahora", () => {
    expect(estadoParaElIcono([reunion(-5)], AHORA)).toBe("en_curso");
  });

  it("«hoy» cuando solo hay una más tarde", () => {
    expect(estadoParaElIcono([reunion(240)], AHORA)).toBe("hoy");
  });

  it("«en_curso» gana sobre «hoy»", () => {
    // Avisar de la de las siete mientras la de ahora está esperando es ruido.
    expect(estadoParaElIcono([reunion(240), reunion(-5)], AHORA)).toBe("en_curso");
  });

  it("apagado si todas las de hoy ya terminaron", () => {
    expect(estadoParaElIcono([reunion(-DESPUES_MIN - 30)], AHORA)).toBe(null);
  });

  it("los datos REALES de producción no encienden nada de más", () => {
    // Las dos reuniones que existen el 2026-08-06, evaluadas a las 12:49 hora de México
    // (18:49 UTC). La del 28 de julio sigue con estado 'convocada' —nada la pasa a
    // 'terminada'— así que si la regla mirara solo el estado, el icono llevaría nueve días
    // encendido. La de hoy empezó a las 12:00, o sea 49 minutos antes: dentro de la ventana.
    const ahoraReal = new Date("2026-08-06T18:49:00Z").getTime();
    const produccion = [
      { id: "1", titulo: "Prueba", inicio: "2026-07-28T16:40:00Z", fin: null, estado: "convocada" },
      { id: "2", titulo: "Reunion de prueba", inicio: "2026-08-06T18:00:00Z", fin: null, estado: "convocada" },
    ];
    expect(enCurso(produccion[0], ahoraReal)).toBe(false);
    expect(estadoParaElIcono(produccion, ahoraReal)).toBe("en_curso");

    // Tres horas después, la de hoy ya se cerró y no queda nada: apagado.
    const masTarde = new Date("2026-08-06T21:30:00Z").getTime();
    expect(estadoParaElIcono(produccion, masTarde)).toBe(null);
  });
});
