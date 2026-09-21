import { saldoVacaciones, aniosCumplidos } from "./vacaciones";

/**
 * Finiquito, liquidación y aguinaldo (la ley lo llama "gratificación anual", Art. 87 LFT).
 *
 * Fórmulas de la Ley Federal del Trabajo, tal cual las usa cualquier calculadora de finiquito
 * en México — esto NO es una regla propia de la clínica, a diferencia de nomina.js (donde el
 * descuento por retardo/falta sí es una decisión del dueño). Aquí no hay margen para
 * inventar: son los artículos 48, 50, 76-80, 87 y 162 de la LFT.
 *
 * Reutiliza saldoVacaciones()/aniosCumplidos() de vacaciones.js en vez de recalcular la
 * antigüedad o el saldo de vacaciones por su cuenta: la clínica da 8 días por año (no la
 * tabla progresiva de la reforma 2023, ver vacaciones.js), y esa es la cifra real que hay
 * que pagar — no la que dirían las calculadoras genéricas de internet.
 *
 * "Salario diario" aquí es el NOMINAL (sueldoSemanal / 7, la misma fórmula que ya usa
 * nomina.js para la falta) — no el Salario Diario Integrado (SDI). El SDI sumaría el
 * factor de aguinaldo/prima vacacional/otras prestaciones, y esta app no captura esas
 * prestaciones como un %, así que sería un número inventado. Se documenta la
 * simplificación en vez de escondarla.
 */

const monto = (v) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const pesos = (n) => Math.round((Number(n) || 0) * 100) / 100;

const soloFecha = (valor) => String(valor || "").slice(0, 10);
const esFechaISO = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor);

const aUTC = (fechaISO) => {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const MS_DIA = 24 * 60 * 60 * 1000;

/** Días de calendario entre dos fechas ISO, ambas incluidas. */
const diasInclusive = (desde, hasta) => Math.round((aUTC(hasta) - aUTC(desde)) / MS_DIA) + 1;

// ---------------------------------------------------------------------------
// Constantes de ley. Ninguna se toma de una API externa a propósito: cambian poco (la
// última reforma de fondo fue 2023) y un valor mal traído de internet en tiempo real es
// peor que uno fijo y documentado. `salarioMinimoDiario` para el tope de la prima de
// antigüedad SÍ se pide como parámetro (ver calcularLiquidacion): ese sí cambia cada
// año (1 de enero) y no hay forma honesta de fijarlo sin que quede obsoleto.
// ---------------------------------------------------------------------------

/** Aguinaldo mínimo, Art. 87 LFT. La clínica puede dar más; se pide como parámetro. */
export const DIAS_AGUINALDO_MINIMO = 15;
/** Indemnización constitucional por despido injustificado, Art. 50 fracc. III LFT. */
export const DIAS_INDEMNIZACION_CONSTITUCIONAL = 90;
/** 20 días de salario por año de servicio, despido injustificado, Art. 50 fracc. II LFT. */
export const DIAS_POR_ANIO_DESPIDO = 20;
/** Prima de antigüedad, Art. 162 LFT — tope de 2 salarios mínimos diarios. */
export const DIAS_PRIMA_ANTIGUEDAD_POR_ANIO = 12;
/** Prima vacacional, Art. 80 LFT: mínimo 25% sobre los días de vacaciones que se pagan. */
export const PORCENTAJE_PRIMA_VACACIONAL = 0.25;

/** Salario diario NOMINAL — misma fórmula que descuentoDelDia() usa para la falta. */
export const salarioDiario = (sueldoSemanal) => pesos(monto(sueldoSemanal) / 7);

/**
 * Días naturales trabajados EN EL AÑO de `fecha` (para el aguinaldo proporcional): desde
 * el 1 de enero de ese año, o desde `fechaIngreso` si entró ya avanzado ESE MISMO año —
 * a alguien que entró hace tres años no se le cuenta desde su ingreso, se le cuenta desde
 * enero, porque los aguinaldos de los años anteriores ya se pagaron por su cuenta.
 */
export const diasTrabajadosEnAnio = (fechaIngreso, fecha) => {
  const f = soloFecha(fecha);
  if (!esFechaISO(f)) return 0;
  const ingreso = soloFecha(fechaIngreso);
  const inicioAnio = `${f.slice(0, 4)}-01-01`;
  const desde = esFechaISO(ingreso) && ingreso > inicioAnio ? ingreso : inicioAnio;
  return Math.max(0, diasInclusive(desde, f));
};

/** Aguinaldo proporcional a los días trabajados en el año, en pesos. */
export const calcularAguinaldo = ({ sueldoSemanal, fechaIngreso, fecha, diasAguinaldo = DIAS_AGUINALDO_MINIMO }) => {
  const diario = salarioDiario(sueldoSemanal);
  const dias = diasTrabajadosEnAnio(fechaIngreso, fecha);
  const montoAguinaldo = pesos(monto(diasAguinaldo) * diario * (dias / 365));
  return { salarioDiario: diario, diasTrabajadosAnio: dias, diasAguinaldo: monto(diasAguinaldo), montoAguinaldo };
};

/**
 * Finiquito: lo que se paga siempre al terminar la relación laboral, la haya terminado
 * quien la haya terminado — es la base común de una renuncia Y de un despido.
 *
 * `diasPendientesPago`: días ya trabajados que aún no se le pagaron (el corte de nómina
 * no cae siempre justo el día de salida). Se pide como número porque esta app no lleva
 * un corte de nómina por día — RH lo sabe de memoria o lo cuenta del calendario.
 */
export const calcularFiniquito = ({
  sueldoSemanal,
  fechaIngreso,
  fechaSalida,
  vacacionesEmpleado = [],
  diasPendientesPago = 0,
  diasAguinaldo = DIAS_AGUINALDO_MINIMO,
  otrasPercepciones = 0,
}) => {
  const diario = salarioDiario(sueldoSemanal);
  const montoDiasPendientes = pesos(monto(diasPendientesPago) * diario);

  const saldo = saldoVacaciones(fechaIngreso, vacacionesEmpleado, fechaSalida);
  const diasVacacionesPendientes = saldo.disponibles;
  const montoVacaciones = pesos(diasVacacionesPendientes * diario);
  const montoPrimaVacacional = pesos(montoVacaciones * PORCENTAJE_PRIMA_VACACIONAL);

  const aguinaldo = calcularAguinaldo({ sueldoSemanal, fechaIngreso, fecha: fechaSalida, diasAguinaldo });

  const otras = monto(otrasPercepciones);
  const total = pesos(
    montoDiasPendientes + montoVacaciones + montoPrimaVacacional + aguinaldo.montoAguinaldo + otras
  );

  return {
    salarioDiario: diario,
    diasPendientesPago: monto(diasPendientesPago),
    montoDiasPendientes,
    diasVacacionesPendientes,
    montoVacaciones,
    montoPrimaVacacional,
    diasAguinaldo: aguinaldo.diasAguinaldo,
    diasTrabajadosAnio: aguinaldo.diasTrabajadosAnio,
    montoAguinaldo: aguinaldo.montoAguinaldo,
    otrasPercepciones: otras,
    total,
  };
};

/**
 * Liquidación: el finiquito de arriba MÁS lo que solo corresponde a un despido
 * injustificado — indemnización constitucional, 20 días por año, y prima de antigüedad.
 *
 * `salarioMinimoDiario`: el tope de la prima de antigüedad son DOS salarios mínimos
 * diarios (Art. 162 LFT), y el salario mínimo cambia cada 1 de enero. Si no se da (0 o
 * ausente), se calcula SIN tope — mejor un número de más visible y corregible en pantalla
 * que una cifra vieja hardcodeada que nadie recuerda actualizar.
 */
export const calcularLiquidacion = ({
  sueldoSemanal,
  fechaIngreso,
  fechaSalida,
  vacacionesEmpleado = [],
  diasPendientesPago = 0,
  diasAguinaldo = DIAS_AGUINALDO_MINIMO,
  otrasPercepciones = 0,
  salarioMinimoDiario = 0,
}) => {
  const base = calcularFiniquito({
    sueldoSemanal, fechaIngreso, fechaSalida, vacacionesEmpleado, diasPendientesPago, diasAguinaldo,
  });
  const diario = base.salarioDiario;
  const anios = aniosCumplidos(fechaIngreso, fechaSalida);

  const montoIndemnizacion = pesos(DIAS_INDEMNIZACION_CONSTITUCIONAL * diario);
  const montoVeinteDias = pesos(DIAS_POR_ANIO_DESPIDO * diario * anios);

  const tope = monto(salarioMinimoDiario) * 2;
  const diarioParaPrima = tope > 0 ? Math.min(diario, tope) : diario;
  const montoPrimaAntiguedad = pesos(DIAS_PRIMA_ANTIGUEDAD_POR_ANIO * diarioParaPrima * anios);

  const otras = monto(otrasPercepciones);
  const total = pesos(base.total - base.otrasPercepciones + montoIndemnizacion + montoVeinteDias + montoPrimaAntiguedad + otras);

  return {
    ...base,
    otrasPercepciones: otras,
    aniosAntiguedad: anios,
    montoIndemnizacion,
    montoVeinteDias,
    primaAntiguedadTopada: tope > 0 && diario > tope,
    montoPrimaAntiguedad,
    total,
  };
};
