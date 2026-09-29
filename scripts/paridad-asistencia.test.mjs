/**
 * ¿Da la base lo MISMO que la web?
 *
 * `resumen_asistencia_semana` y `recibo_semana` (migración 177) portan a SQL las reglas que
 * deciden el estado de cada día y cuánto se cobra por él. Esas reglas viven en JavaScript
 * (`src/utils/asistencia.js` + `src/utils/nomina.js`) y son las que RH ve en la Nómina. La app
 * nativa enseña lo que dice la base.
 *
 * Si las dos no coinciden, el empleado ve un número en la app y su jefe otro en la web. Esta
 * prueba compara SEMANA A SEMANA —como se cobra, con el arrastre de la salida del fin de semana—
 * y EXIGE CERO DIFERENCIAS. No promedia ni tolera "casi".
 *
 * YA SE SEPARARON UNA VEZ: la 174 se escribió el 2026-09-21 y entre el 23 y el 26 la web añadió
 * festivos, salida anticipada, sueldo fijo… sin tocar la base. Nadie se enteró hasta que se
 * volvió a correr esto. Por eso tiene que correr cada vez que cambien esas reglas.
 *
 * Los datos los vuelca `scripts/paridad-asistencia.sql` (solo lectura, termina en rollback):
 *
 *   ssh ... "docker exec -i pulse-db psql -U postgres -t -A \
 *     -v desde=<LUNES> -v hasta=<DOMINGO> -v sub=<auth_user_id de un admin>" \
 *     < scripts/paridad-asistencia.sql > datos.json
 *
 *   PARIDAD_JSON=datos.json npx vitest run scripts/paridad-asistencia.test.mjs
 *
 * Es una prueba de PARIDAD, no de corrección: da por buena la web.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { construirDias, ESTADOS_DIA } from "../src/utils/asistencia";
import { calcularNomina, inicioConArrastre } from "../src/utils/nomina";

const archivo = process.env.PARIDAD_JSON;

const centavos = (n) => (n == null ? null : Math.round(Number(n) * 100));

/** Lo que calcula la web para una persona y una semana, igual que Nomina.jsx. */
const reciboWeb = (e, lunes, domingo, datos) => {
  const dias = construirDias({
    desde: inicioConArrastre(lunes),
    hasta: domingo,
    checadas: e.checadas,
    horarios: e.horarios,
    permisos: e.permisos,
    vacaciones: e.vacaciones,
    festivos: datos.festivos,
    intercambios: e.intercambios,
    fechaIngreso: e.fechaIngreso,
    tz: e.zona,
    hoy: e.hoy,
  });
  const recibo = calcularNomina({
    // Sueldo fijo (mig. 172): Nomina.jsx no le pasa días, no descuenta nada.
    dias: e.sueldoFijo ? [] : dias,
    desde: lunes,
    sueldoSemanal: e.sueldoSemanal,
    config: { montoRetardo: datos.config?.montoRetardo },
    puesto: e.puesto,
    montoRetardoPersonal: e.montoRetardoPersonal,
  });
  return { dias, recibo };
};

describe.skipIf(!archivo)("las funciones de la base contra las reglas de la web", () => {
  const datos = archivo ? JSON.parse(readFileSync(archivo, "utf8")) : {};
  const { semanas = [], empleados = [] } = datos;

  it("clasifica cada día igual y cobra lo mismo", () => {
    const diferencias = [];
    let dias = 0;

    for (const e of empleados) {
      for (const { lunes, domingo } of semanas) {
        const { dias: calculados, recibo } = reciboWeb(e, lunes, domingo, datos);
        const detalle = new Map(recibo.detalle.map((d) => [d.fecha, d]));
        const sql = (e.porSemana || []).find((s) => s.lunes === lunes)?.dias || [];
        const porFechaSql = new Map(sql.map((r) => [r.fecha, r]));

        // Los días que la web cobra en este recibo: los de la semana, y del fin de semana
        // anterior solo los que traen salida que cobrar (la base no devuelve los demás).
        const esperados = calculados.filter((d) => {
          if (d.fecha >= lunes) return true;
          return (detalle.get(d.fecha)?.descuentoSalida || 0) > 0;
        });

        for (const d of esperados) {
          dias++;
          const q = porFechaSql.get(d.fecha);
          const donde = `${e.nombre} ${d.fecha} (semana ${lunes})`;
          if (!q) {
            diferencias.push(`${donde}: la función no devolvió el día (JS: ${d.estado})`);
            continue;
          }
          if (q.estado !== d.estado) diferencias.push(`${donde}: estado SQL=${q.estado} JS=${d.estado}`);

          // Con sueldo fijo la web no arma detalle: todo lo del día vale 0.
          const det = detalle.get(d.fecha);
          const descuentoJs = det ? det.descuento : 0;
          const salidaJs = det ? det.descuentoSalida : 0;
          if (centavos(q.descuento) !== centavos(descuentoJs)) {
            diferencias.push(`${donde}: descuento SQL=${q.descuento} JS=${descuentoJs}`);
          }
          if (centavos(q.descuentoSalida) !== centavos(salidaJs)) {
            diferencias.push(`${donde}: salida SQL=${q.descuentoSalida} JS=${salidaJs}`);
          }
          if (Boolean(q.salidaAnticipada) !== Boolean(d.esSalidaAnticipada)) {
            diferencias.push(`${donde}: salidaAnticipada SQL=${q.salidaAnticipada} JS=${d.esSalidaAnticipada}`);
          }
          if (Boolean(q.arrastre) !== d.fecha < lunes) {
            diferencias.push(`${donde}: arrastre SQL=${q.arrastre}`);
          }
          // Los minutos solo se comparan donde significan algo.
          if (
            (d.estado === ESTADOS_DIA.RETARDO || d.estado === ESTADOS_DIA.INCOMPLETO) &&
            q.minutosRetardo !== d.minutosRetardo
          ) {
            diferencias.push(`${donde}: minutos SQL=${q.minutosRetardo} JS=${d.minutosRetardo}`);
          }
        }

        // Días que devuelve la función y la web no: también es diferencia.
        const fechasJs = new Set(esperados.map((d) => d.fecha));
        for (const r of sql) {
          if (!fechasJs.has(r.fecha)) {
            diferencias.push(`${e.nombre} ${r.fecha} (semana ${lunes}): la función devolvió un día que JS no (${r.estado})`);
          }
        }
      }
    }

    console.log(`paridad: ${empleados.length} empleados, ${semanas.length} semanas, ${dias} días, ${diferencias.length} diferencias`);
    expect(diferencias.slice(0, 30), `${diferencias.length} diferencias`).toEqual([]);
    expect(dias).toBeGreaterThan(0);
  });

  it("suma cada recibo igual: sueldo, descuentos por concepto y pago final", () => {
    const diferencias = [];

    for (const e of empleados) {
      for (const { lunes, domingo } of semanas) {
        const { recibo: js } = reciboWeb(e, lunes, domingo, datos);
        const sql = (e.porSemana || []).find((s) => s.lunes === lunes)?.recibo;
        const donde = `${e.nombre} (semana ${lunes})`;

        if (!sql) {
          diferencias.push(`${donde}: la función no devolvió recibo`);
          continue;
        }

        const dinero = [
          ["sueldo", sql.sueldoSemanal, js.sueldo],
          ["descuento", sql.descuento, js.descuento],
          ["montoRetardos", sql.montoRetardos, js.montoRetardos],
          ["montoFaltas", sql.montoFaltas, js.montoFaltas],
          ["montoSalidas", sql.montoSalidas, js.montoSalidas],
          // El pago final es el número que la persona espera ver: el que se compara con lo que
          // le depositan.
          ["pagoFinal", sql.pagoFinal, js.pagoFinal],
        ];
        for (const [nombre, a, b] of dinero) {
          if (centavos(a) !== centavos(b)) diferencias.push(`${donde}: ${nombre} SQL=${a} JS=${b}`);
        }
        const cuentas = [
          ["retardos", sql.retardos, js.retardos],
          ["faltas", sql.faltas, js.faltas],
          ["salidasAnticipadas", sql.salidasAnticipadas, js.salidasAnticipadas],
        ];
        for (const [nombre, a, b] of cuentas) {
          if (Number(a) !== Number(b)) diferencias.push(`${donde}: ${nombre} SQL=${a} JS=${b}`);
        }
        if (Boolean(sql.sinSueldo) !== Boolean(js.sinSueldo)) {
          diferencias.push(`${donde}: sinSueldo SQL=${sql.sinSueldo} JS=${js.sinSueldo}`);
        }
      }
    }

    console.log(`recibos: ${empleados.length} empleados × ${semanas.length} semanas, ${diferencias.length} diferencias`);
    expect(diferencias.slice(0, 30), `${diferencias.length} diferencias`).toEqual([]);
  });
});
