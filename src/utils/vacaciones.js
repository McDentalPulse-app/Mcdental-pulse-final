/**
 * Derecho a vacaciones por antigüedad.
 *
 * Regla de la clínica: las vacaciones se DESBLOQUEAN al cumplir el primer año, y son 8 días
 * por cada año de servicio. El saldo se REINICIA en cada aniversario: lo que no se tomó en
 * su periodo se pierde, no se acumula.
 *
 * El "año de vacaciones" NO es el año natural: va de aniversario a aniversario. Alguien que
 * entró un 10 de marzo estrena sus 8 días cada 10 de marzo, no cada 1 de enero.
 *
 * LOS DÍAS SE REPARTEN POR DONDE CAEN, no por donde empieza la solicitud. Unas vacaciones
 * del 5 al 12 de marzo con aniversario el día 10 gastan 5 días del periodo que acaba y 3 del
 * que empieza. Contarlas enteras en el primero regalaba esos 3 días: el periodo nuevo
 * arrancaba con 8 disponibles cuando en realidad ya se habían tomado 3.
 *
 * Todo trabaja con fechas ISO sueltas ("2026-03-10") y devuelve fechas ISO, sin `Date` a la
 * vista: una fecha sin hora la interpreta el navegador como medianoche UTC y en México eso
 * cae el día ANTERIOR — el mismo tropiezo que ya documenta formatFechaCorta en helpers.js.
 */

export const DIAS_VACACIONES_POR_ANIO = 8;
export const ANIOS_ANTIGUEDAD_MINIMA = 1;

/** Estados que ya consumen saldo. Una solicitud pendiente cuenta: si no, se podrían pedir
 *  los mismos 8 días tres veces mientras RH no responde. Las rechazadas no consumen nada. */
const ESTADOS_QUE_CONSUMEN = new Set(["pendiente", "aprobado", "aprobada"]);

const MS_DIA = 24 * 60 * 60 * 1000;

const soloFecha = (valor) => String(valor || "").slice(0, 10);

const esFechaISO = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor);

const aUTC = (fechaISO) => {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const desdeUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Días de calendario entre dos fechas ISO, ambas incluidas. */
const diasInclusive = (desde, hasta) => Math.round((aUTC(hasta) - aUTC(desde)) / MS_DIA) + 1;

const sumarDias = (fechaISO, dias) => desdeUTC(aUTC(fechaISO) + dias * MS_DIA);

/**
 * Días de calendario entre `hoy` y `fecha` — negativo si `fecha` ya pasó. Sirve para exigir un
 * mínimo de anticipación al pedir vacaciones o el cambio de un festivo (ver
 * `diasAnticipacionRequerida` en utils/constants.js, que decide CUÁNTOS días hacen falta según
 * la sucursal; esta función solo mide la distancia entre dos fechas).
 */
export const diasDeAnticipacion = (hoy, fecha) => {
  const h = soloFecha(hoy);
  const f = soloFecha(fecha);
  if (!esFechaISO(h) || !esFechaISO(f)) return null;
  return Math.round((aUTC(f) - aUTC(h)) / MS_DIA);
};

/**
 * Suma años a una fecha ISO.
 *
 * El 29 de febrero se RECORTA al 28 en los años no bisiestos. `new Date(2025, 1, 29)` desborda
 * solo al 1 de marzo, pero Postgres (`fecha + interval '1 year'`) recorta al 28 — y el mismo
 * cálculo vive en el trigger de la migración 162. Si cada lado eligiera un día distinto, a quien
 * entró un 29 de febrero la pantalla y la base le dirían fechas de aniversario diferentes.
 */
const sumarAnios = (fechaISO, anios) => {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y + anios, m - 1, d);
  if (fecha.getMonth() !== m - 1) fecha.setDate(0); // desbordó de mes: al último día del anterior
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mm}-${dd}`;
};

/** Años de servicio CUMPLIDOS en una fecha dada. 0 si aún no llega al primer aniversario. */
export const aniosCumplidos = (fechaIngreso, fecha) => {
  const ingreso = soloFecha(fechaIngreso);
  const dia = soloFecha(fecha);
  if (!esFechaISO(ingreso) || !esFechaISO(dia) || dia < ingreso) return 0;

  const aproximado = Number(dia.slice(0, 4)) - Number(ingreso.slice(0, 4));
  // Si el aniversario de ese año todavía no llega, aún no cumplió ese año.
  return sumarAnios(ingreso, aproximado) > dia ? aproximado - 1 : aproximado;
};

/**
 * Periodo de vacaciones que CONTIENE esa fecha: del último aniversario cumplido al siguiente
 * (fin exclusivo). Null mientras no tenga un año, que es cuando aún no hay derecho que medir.
 */
export const periodoVacaciones = (fechaIngreso, fecha) => {
  const anios = aniosCumplidos(fechaIngreso, fecha);
  if (anios < ANIOS_ANTIGUEDAD_MINIMA) return null;
  const ingreso = soloFecha(fechaIngreso);
  return { inicio: sumarAnios(ingreso, anios), fin: sumarAnios(ingreso, anios + 1), anios };
};

/** Último día de una solicitud. Sin `fechaFin` se deduce de los días (una solicitud de 1 día). */
const finDeSolicitud = (solicitud) => {
  const inicio = soloFecha(solicitud?.fechaInicio);
  const fin = soloFecha(solicitud?.fechaFin);
  if (esFechaISO(fin) && fin >= inicio) return fin;
  const dias = Number(solicitud?.dias);
  return Number.isFinite(dias) && dias > 1 ? sumarDias(inicio, dias - 1) : inicio;
};

/** Días de una solicitud que caen DENTRO de un periodo. 0 si no lo toca. */
export const diasEnPeriodo = (solicitud, periodo) => {
  const inicio = soloFecha(solicitud?.fechaInicio);
  if (!esFechaISO(inicio) || !periodo) return 0;

  const desde = inicio > periodo.inicio ? inicio : periodo.inicio;
  const ultimoDelPeriodo = sumarDias(periodo.fin, -1); // `fin` es exclusivo
  const fin = finDeSolicitud(solicitud);
  const hasta = fin < ultimoDelPeriodo ? fin : ultimoDelPeriodo;

  return hasta < desde ? 0 : diasInclusive(desde, hasta);
};

const consume = (solicitud) =>
  ESTADOS_QUE_CONSUMEN.has(String(solicitud?.estado || "").toLowerCase());

/** Días ya comprometidos (pendientes + aprobados) dentro de un periodo. */
export const diasUsadosEnPeriodo = (vacacionesEmpleado = [], periodo) =>
  vacacionesEmpleado
    .filter(consume)
    .reduce((suma, v) => suma + diasEnPeriodo(v, periodo), 0);

/**
 * Saldo del periodo vigente, para enseñárselo al empleado.
 *
 * `desbloqueado: false` significa "todavía no cumple el año", y entonces `disponibles` es 0:
 * no es que se le hayan acabado, es que aún no las tiene.
 */
export const saldoVacaciones = (fechaIngreso, vacacionesEmpleado = [], hoy) => {
  const periodo = periodoVacaciones(fechaIngreso, hoy);
  const ingreso = soloFecha(fechaIngreso);

  if (!periodo) {
    return {
      desbloqueado: false,
      anios: aniosCumplidos(ingreso, hoy),
      periodo: null,
      total: 0,
      usados: 0,
      disponibles: 0,
      proximoAniversario: esFechaISO(ingreso) ? sumarAnios(ingreso, ANIOS_ANTIGUEDAD_MINIMA) : "",
    };
  }

  const usados = diasUsadosEnPeriodo(vacacionesEmpleado, periodo);

  return {
    desbloqueado: true,
    anios: periodo.anios,
    periodo,
    total: DIAS_VACACIONES_POR_ANIO,
    usados,
    disponibles: Math.max(0, DIAS_VACACIONES_POR_ANIO - usados),
    proximoAniversario: periodo.fin,
  };
};

/**
 * ¿Cabe esta solicitud?
 *
 * Tres cosas distintas, y las tres hacen falta:
 *  1. Que HOY ya tenga el año cumplido. Si no, no puede pedir vacaciones — ni para hoy ni
 *     para el año que viene. Es lo mismo que le dice la pantalla, y así no hay un botón
 *     activo debajo de un aviso que dice que están bloqueadas.
 *  2. Que se pida con la anticipación mínima que le toque (`diasAnticipacionMinima`, ver
 *     `diasAnticipacionRequerida` en utils/constants.js — 30 días en general, 15 para Oficina
 *     Administrativa). Pedido del dueño, 2026-09-24: da tiempo a que la clínica acomode la
 *     cobertura antes de que la persona se vaya.
 *  3. Que quepan en CADA periodo que toca el rango. Unas vacaciones a caballo del aniversario
 *     tienen que caber en los dos lados: 5 días en el que acaba y 3 en el que empieza.
 *
 * Devuelve `{ ok: true }` o el motivo con el periodo culpable, para que quien llame componga
 * el aviso con las fechas ya formateadas.
 */
export const validarSolicitud = (fechaIngreso, vacacionesEmpleado = [], fechaInicio, fechaFin, hoy, diasAnticipacionMinima = 0) => {
  const inicio = soloFecha(fechaInicio);
  const fin = soloFecha(fechaFin) || inicio;
  const ingreso = soloFecha(fechaIngreso);

  if (!esFechaISO(inicio)) {
    return { ok: false, motivo: "fechas" };
  }
  if (esFechaISO(fin) && fin < inicio) {
    return { ok: false, motivo: "rango" };
  }
  if (!esFechaISO(ingreso)) {
    return { ok: false, motivo: "sin_ingreso" };
  }

  const periodoHoy = periodoVacaciones(ingreso, hoy);
  const periodoInicio = periodoVacaciones(ingreso, inicio);
  if (!periodoHoy || !periodoInicio) {
    return {
      ok: false,
      motivo: "bloqueado",
      proximoAniversario: sumarAnios(ingreso, ANIOS_ANTIGUEDAD_MINIMA),
    };
  }

  if (diasAnticipacionMinima > 0) {
    const anticipacion = diasDeAnticipacion(hoy, inicio);
    if (anticipacion !== null && anticipacion < diasAnticipacionMinima) {
      return {
        ok: false,
        motivo: "anticipacion",
        diasAnticipacionMinima,
        primeraFechaPermitida: sumarDias(soloFecha(hoy), diasAnticipacionMinima),
      };
    }
  }

  const solicitud = { fechaInicio: inicio, fechaFin: fin };

  for (
    let periodo = periodoInicio;
    periodo && periodo.inicio <= fin;
    periodo = periodoVacaciones(ingreso, periodo.fin)
  ) {
    const pide = diasEnPeriodo(solicitud, periodo);
    if (pide === 0) continue;

    const usados = diasUsadosEnPeriodo(vacacionesEmpleado, periodo);
    const disponibles = Math.max(0, DIAS_VACACIONES_POR_ANIO - usados);

    if (pide > disponibles) {
      return {
        ok: false,
        motivo: disponibles === 0 ? "agotado" : "excede",
        periodo,
        pide,
        disponibles,
      };
    }
  }

  return { ok: true };
};
