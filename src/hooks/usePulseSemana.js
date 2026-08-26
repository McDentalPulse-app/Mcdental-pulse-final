import { useMemo, useState } from "react";
import { periodoActual, normalizeSucursal, formatSemanaDisplay } from "../utils/constants";
import { getPulseStatus, tieneScoreValido } from "../utils/pulseScore";
import { nivelColor } from "../config/theme";
import { esEmpleadoActivo } from "../utils/helpers";

/**
 * Todo lo que los tres dashboards calculan igual: la semana elegida, el Pulse Score de cada
 * colaborador, el semáforo, las sucursales en riesgo y quién está en rojo.
 *
 * POR QUÉ UN HOOK: admin y psicóloga tenían este mismo cálculo copiado, con las mismas ~60
 * líneas de buckets de semana y promedios. Ya habían empezado a divergir —el de psicóloga
 * cortaba a 6 semanas y el de admin a 8 sucursales, cada uno por su cuenta— y cada arreglo
 * había que acordarse de hacerlo dos veces. Con RH sumándose serían tres.
 *
 * Las semanas se agrupan en «buckets»: todo lo anterior al lanzamiento se junta bajo una sola
 * etiqueta (`2026-W00`) porque son pilotos sueltos que no significan nada por separado, y
 * ofrecer diez semanas vacías en el desplegable solo hace perder el tiempo.
 */
export const usePulseSemana = (encuestas = [], usuarios = [], nombresSucursales = []) => {
  const empleados = useMemo(() => usuarios.filter(esEmpleadoActivo), [usuarios]);

  const { bucketWeeks, opcionesSemana, labelActual } = useMemo(() => {
    const semanasRaw = [...new Set(
      encuestas.filter((e) => tieneScoreValido(e.score)).map((e) => String(e.semana))
    )];
    const buckets = {};
    semanasRaw.forEach((w) => { (buckets[formatSemanaDisplay(w)] ||= []).push(w); });
    const actual = formatSemanaDisplay(periodoActual);
    return {
      bucketWeeks: buckets,
      labelActual: actual,
      opcionesSemana: [...new Set([actual, ...Object.keys(buckets)])].sort((a, b) => b.localeCompare(a)),
    };
  }, [encuestas]);

  // Arranca en la semana que TENGA datos, no forzosamente en la actual: si es lunes por la
  // mañana y nadie ha contestado todavía, abrir en una semana vacía parece que la app está rota.
  const porDefecto = bucketWeeks[labelActual]
    ? labelActual
    : (opcionesSemana.find((o) => bucketWeeks[o]) || labelActual);

  const [weekSel, setWeekSel] = useState(porDefecto);
  const semana = bucketWeeks[weekSel] || weekSel === labelActual ? weekSel : porDefecto;

  // En su propio useMemo: si se calcula suelto, es un array nuevo en cada render y el useMemo
  // grande de abajo se recalcularia siempre — con ~100 empleados y todas sus encuestas, eso es
  // trabajo real en cada pulsacion de tecla de cualquier otra parte de la pantalla.
  const selRawWeeks = useMemo(
    () => bucketWeeks[semana] || (semana === labelActual ? [periodoActual] : []),
    [bucketWeeks, semana, labelActual]
  );

  const datos = useMemo(() => {
    // La encuesta MÁS RECIENTE de la persona dentro del bucket, y su score anterior (tendencia).
    const encDelBucket = (empId) =>
      encuestas
        .filter((e) => e.empleadoId === empId && tieneScoreValido(e.score) && selRawWeeks.includes(String(e.semana)))
        .sort((a, b) => String(b.semana).localeCompare(String(a.semana)))[0];

    const scorePrevio = (empId) => {
      const minSel = [...selRawWeeks].sort()[0] || "";
      const prev = encuestas
        .filter((e) => e.empleadoId === empId && tieneScoreValido(e.score) && String(e.semana) < minSel)
        .sort((a, b) => String(b.semana).localeCompare(String(a.semana)))[0];
      return prev ? Math.round(Number(prev.score)) : null;
    };

    const pulsePorEmpleado = empleados.map((emp) => {
      const enc = encDelBucket(emp.id);
      const score = enc ? Math.round(Number(enc.score)) : null;
      const sinDatos = score == null;
      const status = sinDatos
        ? { label: "Sin datos", semaforo: "Sin datos", nivel: "sin-datos" }
        : getPulseStatus(score);
      const prev = sinDatos ? null : scorePrevio(emp.id);
      const tendencia = prev == null ? "→" : score > prev ? "↑" : score < prev ? "↓" : "→";
      return {
        empleado: emp,
        score,
        sinDatos,
        status,
        pulse: { score, color: nivelColor(status.nivel), nivel: status.label, tendencia },
      };
    });

    const conDatos = pulsePorEmpleado.filter((e) => !e.sinDatos);

    // Sucursales con colaboradores en amarillo o rojo, las 5 peores.
    const mapa = {};
    pulsePorEmpleado.forEach(({ empleado, status, sinDatos, score, pulse }) => {
      const suc = normalizeSucursal(empleado.sucursal) || "Sin sucursal";
      (mapa[suc] ||= { suc, total: 0, riesgo: 0, emps: [] });
      mapa[suc].total += 1;
      const nivel = sinDatos ? "sin-datos"
        : status.semaforo === "Rojo" ? "rojo"
        : status.semaforo === "Amarillo" ? "amarillo" : "verde";
      if (nivel === "rojo" || nivel === "amarillo") {
        mapa[suc].riesgo += 1;
        mapa[suc].emps.push({ emp: empleado, score, nivel, tendencia: pulse.tendencia });
      }
    });
    const sucursalesRiesgo = Object.values(mapa)
      .filter((x) => x.riesgo > 0)
      .sort((a, b) => b.riesgo - a.riesgo)
      .slice(0, 5);
    // Los rojos primero dentro de cada sucursal: son los que hay que mirar antes.
    sucursalesRiesgo.forEach((s) => s.emps.sort((a, b) => (a.nivel === "rojo" ? 0 : 1) - (b.nivel === "rojo" ? 0 : 1)));

    const avgPulse = conDatos.length
      ? Math.round(conDatos.reduce((s, e) => s + Number(e.score), 0) / conDatos.length)
      : null;

    // Promedio por sucursal, con TODAS las sucursales activas — también las que no tienen
    // respuestas, que salen como "Sin datos". Omitirlas escondería justo a las que no contestan.
    const porSucursal = nombresSucursales.map((s) => {
      const scores = empleados
        .filter((e) => (normalizeSucursal(e.sucursal) || "Sin sucursal") === normalizeSucursal(s))
        .map((e) => { const enc = encDelBucket(e.id); return enc ? Number(enc.score) : null; })
        .filter((v) => Number.isFinite(v));
      return {
        label: s,
        hasData: scores.length > 0,
        v: scores.length ? Math.round(scores.reduce((a, c) => a + c, 0) / scores.length) : null,
      };
    });

    return {
      pulsePorEmpleado,
      contestaron: conDatos.length,
      verdes: conDatos.filter((e) => e.status.semaforo === "Verde").length,
      amarillos: conDatos.filter((e) => e.status.semaforo === "Amarillo").length,
      rojos: conDatos.filter((e) => e.status.semaforo === "Rojo").length,
      enFocoRojo: conDatos.filter((e) => e.status.semaforo === "Rojo"),
      sucursalesRiesgo,
      porSucursal,
      avgPulse,
      avgPulseStatus: avgPulse === null
        ? { label: "Sin datos", semaforo: "Sin datos", nivel: "sin-datos" }
        : getPulseStatus(avgPulse),
      participacion: empleados.length ? Math.round((conDatos.length / empleados.length) * 100) : 0,
    };
  }, [encuestas, empleados, nombresSucursales, selRawWeeks]);

  return {
    empleados,
    semana,
    setWeekSel,
    labelActual,
    opcionesSemana,
    ...datos,
  };
};
