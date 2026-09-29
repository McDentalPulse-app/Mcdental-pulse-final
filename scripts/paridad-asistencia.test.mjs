/**
 * ¿Da la base lo MISMO que la web?
 *
 * La función `resumen_asistencia_semana` (migración 174) porta a SQL las reglas que deciden el
 * estado de cada día y cuánto se descuenta por él. Esas reglas ya existían en JavaScript
 * (`src/utils/asistencia.js` + `src/utils/nomina.js`) y son las que RH ve hoy en la nómina.
 *
 * Si las dos versiones no coinciden, el empleado ve un número en la app y su jefe ve otro en la
 * web. Esta prueba compara día por día, empleado por empleado, y EXIGE CERO DIFERENCIAS. No
 * promedia ni tolera "casi": una discrepancia es un fallo.
 *
 * Los datos los vuelca `scripts/paridad-asistencia.sql` contra la base (solo lectura, dentro de
 * una transacción que termina en rollback):
 *
 *   ssh ... "docker exec -i pulse-db psql -U postgres -t -A \
 *     -v desde=YYYY-MM-DD -v hasta=YYYY-MM-DD -v sub=<auth_user_id de un admin>" \
 *     < scripts/paridad-asistencia.sql > datos.json
 *
 *   PARIDAD_JSON=datos.json npx vitest run scripts/paridad-asistencia.test.mjs
 *
 * Es una prueba de PARIDAD, no de corrección: da por buena la web. Su trabajo es impedir que la
 * base y la web se separen, que es lo que haría que a alguien se le cobrara distinto según la
 * pantalla donde mire.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { construirDias, ESTADOS_DIA } from "../src/utils/asistencia";
import { calcularNomina, descuentoDelDia } from "../src/utils/nomina";

const archivo = process.env.PARIDAD_JSON;

describe.skipIf(!archivo)("la función de la base contra las reglas de la web", () => {
  const datos = JSON.parse(readFileSync(archivo, "utf8"));
  const { desde, hasta, config, empleados = [] } = datos;

  it("clasifica cada día igual y descuenta lo mismo", () => {
    const diferencias = [];
    let dias = 0;

    for (const e of empleados) {
      const calculados = construirDias({
        desde,
        hasta,
        checadas: e.checadas,
        horarios: e.horarios,
        permisos: e.permisos,
        vacaciones: e.vacaciones,
        tz: e.zona,
        hoy: e.hoy,
      });
      const porFechaSql = new Map((e.sql || []).map((r) => [r.fecha, r]));

      for (const d of calculados) {
        dias++;
        const sql = porFechaSql.get(d.fecha);
        if (!sql) {
          diferencias.push(`${e.nombre} ${d.fecha}: la función no devolvió el día (JS: ${d.estado})`);
          continue;
        }
        if (sql.estado !== d.estado) {
          diferencias.push(`${e.nombre} ${d.fecha}: estado SQL=${sql.estado} JS=${d.estado}`);
        }

        const descuentoJs = descuentoDelDia(d.estado, {
          config: { montoRetardo: config?.montoRetardo },
          sueldoSemanal: e.sueldoSemanal,
          puesto: e.puesto,
          montoRetardoPersonal: e.montoRetardoPersonal,
        });
        // En centavos, para no pelearse con los decimales de numeric.
        const a = sql.descuento == null ? null : Math.round(Number(sql.descuento) * 100);
        const b = descuentoJs == null ? null : Math.round(Number(descuentoJs) * 100);
        if (a !== b) {
          diferencias.push(`${e.nombre} ${d.fecha}: descuento SQL=${sql.descuento} JS=${descuentoJs}`);
        }

        // Los minutos solo se comparan donde significan algo.
        if (
          (d.estado === ESTADOS_DIA.RETARDO || d.estado === ESTADOS_DIA.INCOMPLETO) &&
          sql.minutosRetardo !== d.minutosRetardo
        ) {
          diferencias.push(
            `${e.nombre} ${d.fecha}: minutos SQL=${sql.minutosRetardo} JS=${d.minutosRetardo}`,
          );
        }
      }

      // Días que devuelve la función y la web no: también es diferencia.
      const fechasJs = new Set(calculados.map((d) => d.fecha));
      for (const r of e.sql || []) {
        if (!fechasJs.has(r.fecha)) {
          diferencias.push(`${e.nombre} ${r.fecha}: la función devolvió un día que JS no (${r.estado})`);
        }
      }
    }

    console.log(`paridad: ${empleados.length} empleados, ${dias} días, ${diferencias.length} diferencias`);
    expect(diferencias.slice(0, 20), `${diferencias.length} diferencias`).toEqual([]);
    expect(dias).toBeGreaterThan(0);
  });

  it("suma el recibo igual: sueldo, descuento y pago final", () => {
    const diferencias = [];

    for (const e of empleados) {
      const dias = construirDias({
        desde,
        hasta,
        checadas: e.checadas,
        horarios: e.horarios,
        permisos: e.permisos,
        vacaciones: e.vacaciones,
        tz: e.zona,
        hoy: e.hoy,
      });

      const js = calcularNomina({
        dias,
        sueldoSemanal: e.sueldoSemanal,
        config: { montoRetardo: config?.montoRetardo },
        puesto: e.puesto,
        montoRetardoPersonal: e.montoRetardoPersonal,
      });
      const sql = e.recibo;

      if (!sql) {
        diferencias.push(`${e.nombre}: la función no devolvió recibo`);
        continue;
      }

      const campos = [
        ["sueldo", sql.sueldoSemanal, js.sueldo],
        ["descuento", sql.descuento, js.descuento],
        // El pago final es el número que la persona espera ver. Si este no cuadra, no cuadra
        // nada: es el que se compara con lo que le depositan.
        ["pagoFinal", sql.pagoFinal, js.pagoFinal],
      ];
      for (const [nombre, a, b] of campos) {
        if (Math.round(Number(a) * 100) !== Math.round(Number(b) * 100)) {
          diferencias.push(`${e.nombre}: ${nombre} SQL=${a} JS=${b}`);
        }
      }
      if (Boolean(sql.sinSueldo) !== Boolean(js.sinSueldo)) {
        diferencias.push(`${e.nombre}: sinSueldo SQL=${sql.sinSueldo} JS=${js.sinSueldo}`);
      }
      if (Number(sql.retardos) !== Number(js.retardos)) {
        diferencias.push(`${e.nombre}: retardos SQL=${sql.retardos} JS=${js.retardos}`);
      }
    }

    console.log(`recibos: ${empleados.length} empleados, ${diferencias.length} diferencias`);
    expect(diferencias.slice(0, 20), `${diferencias.length} diferencias`).toEqual([]);
  });
});
