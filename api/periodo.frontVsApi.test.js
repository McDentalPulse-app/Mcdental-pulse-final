import { describe, it, expect } from "vitest";
import { claveDePeriodo, semanaDesdeNumero } from "../src/utils/constants";
import { semanasDelPeriodo } from "./tareas-programadas.js";

/**
 * El front y el servidor tienen que estar de acuerdo en qué es «este período».
 *
 * POR QUÉ ESTE TEST EXISTE: `api/` y `src/` son dos bundles independientes y hoy no comparten
 * módulos, así que la regla del período está ESCRITA DOS VECES —`claveDePeriodo` en
 * constants.js y `semanasDelPeriodo` en tareas-programadas.js. Un comentario que diga «si
 * cambias uno cambia el otro» no impide que alguien cambie solo uno; esto sí.
 *
 * Lo que se rompe si divergen: el recordatorio del servidor filtra por «quien no tenga encuesta
 * de este período». Si su idea del período no coincide con la clave que el front escribe, las
 * 95 personas reciben avisos martes, jueves y viernes por una encuesta que ya entregaron.
 */
describe("front y servidor coinciden en el período", () => {
  it("la clave que escribe el front es la primera que el servidor acepta, 160 semanas seguidas", () => {
    for (let n = 1; n <= 160; n++) {
      const semana = semanaDesdeNumero(n);
      const aceptadas = semanasDelPeriodo(semana);
      expect(aceptadas[0], `n=${n} (${semana})`).toBe(claveDePeriodo(semana));
    }
  });

  it("el servidor siempre acepta la semana en curso", () => {
    // Cubre al teléfono con el bundle viejo en caché, que manda la semana cruda. Sigue
    // valiendo con el corte apagado y volvería a valer si se encendiera.
    for (let n = 1; n <= 160; n++) {
      const semana = semanaDesdeNumero(n);
      expect(semanasDelPeriodo(semana), `n=${n} (${semana})`).toContain(semana);
    }
  });

  it("con la cadencia semanal el servidor acepta UNA sola semana", () => {
    // Estas cinco estuvieron emparejadas de dos en dos del 10 al 16 de agosto de 2026, mientras
    // la encuesta fue quincenal. Al revertir a semanal cada una vuelve a valerse sola; se dejan
    // justo estas para que se vea el antes y el después en el mismo sitio.
    for (const semana of ["2026-W31", "2026-W32", "2026-W33", "2026-W34", "2026-W35"]) {
      expect(semanasDelPeriodo(semana), semana).toEqual([semana]);
    }
  });
});
