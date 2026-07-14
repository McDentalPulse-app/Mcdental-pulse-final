import { getISOWeek } from "./constants";

/**
 * Lógica de asistencia. Todo aquí es puro: entra data, sale data. Sin React y sin
 * Supabase, porque es lo único de este módulo que se puede testear (en este repo no
 * hay tests de componentes: no está @testing-library ni jsdom). Si esta lógica
 * viviera dentro de un .jsx, nacería sin cobertura.
 *
 * La idea central: el estado de un día (falta, retardo, justificado…) NO se guarda en
 * la base, se DERIVA de las checadas + el horario + los permisos aprobados. Así, si RH
 * aprueba el jueves un permiso para el lunes pasado, ese lunes deja de ser falta solo.
 * Nadie tiene que salir a reescribir filas viejas.
 */

/**
 * Zona horaria de las clínicas. DEBE coincidir con la constante c_tz de la RPC
 * registrar_checada (migración 036): el servidor decide en qué día natural cae una
 * checada, y aquí decidimos si esa checada llegó tarde. Si las dos zonas se separan,
 * las salidas de la tarde se irían al día siguiente y los retardos se calcularían
 * contra la hora equivocada.
 */
export const TZ_CLINICA = "America/Monterrey";

export const ESTADOS_DIA = {
  PRESENTE: "presente",
  RETARDO: "retardo",
  FALTA: "falta",
  JUSTIFICADO: "justificado",
  DESCANSO: "descanso",
  INCOMPLETO: "incompleto",
};

const MIN_POR_DIA = 24 * 60;

/** Minutos desde medianoche de "HH:MM" o "HH:MM:SS". */
export const horaAMinutos = (hora) => {
  if (typeof hora !== "string") return null;
  const [h, m] = hora.split(":");
  const horas = Number(h);
  const minutos = Number(m);
  if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return null;
  return horas * 60 + minutos;
};

/** "09:05" a partir de minutos desde medianoche. Para pintar, no para calcular. */
export const minutosAHora = (min) => {
  if (!Number.isFinite(min)) return "";
  const h = Math.floor(((min % MIN_POR_DIA) + MIN_POR_DIA) % MIN_POR_DIA / 60);
  const m = Math.round(((min % 60) + 60) % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Minutos desde medianoche de un timestamp, EN LA HORA DE LA CLÍNICA.
 *
 * marcada_en viene de Postgres en UTC. Restarlo a pelo contra un "09:00" de la tabla
 * de horarios compararía peras con manzanas: a las 9:00 de Tampico son las 15:00 UTC,
 * y todo el mundo llegaría con 6 horas de retardo. Intl hace la conversión bien,
 * incluidos los cambios de horario de verano, y no añade ninguna dependencia.
 */
export const minutosLocales = (timestamp, tz = TZ_CLINICA) => {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const h = Number(partes.find((p) => p.type === "hour")?.value);
  const m = Number(partes.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  // Intl con hour12:false puede devolver "24" a medianoche en algunos entornos.
  return (h % 24) * 60 + m;
};

/**
 * Día ISO (1=lunes … 7=domingo) de una fecha "YYYY-MM-DD".
 *
 * Se fuerza el parseo en UTC (el guion en new Date("2026-07-13") ya lo hace) y se lee
 * con getUTCDay para que la zona horaria del navegador no corra el día: en un móvil
 * configurado en Tokio, new Date("2026-07-13").getDay() puede devolver lunes.
 */
export const diaISO = (fecha) => {
  if (!fecha) return null;
  const d = new Date(`${String(fecha).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const dow = d.getUTCDay(); // 0=domingo … 6=sábado
  return dow === 0 ? 7 : dow;
};

/** ¿La fecha cae dentro del rango [inicio, fin]? Fin ausente = rango de un solo día. */
const cubreFecha = (fecha, inicio, fin) => {
  if (!inicio) return false;
  const f = String(fecha).slice(0, 10);
  const desde = String(inicio).slice(0, 10);
  const hasta = String(fin || inicio).slice(0, 10);
  return f >= desde && f <= hasta;
};

/**
 * Elige la entrada y la salida que cuentan, de todas las checadas de un día.
 *
 * La PRIMERA entrada y la ÚLTIMA salida: es lo que define la jornada real de alguien
 * que sale a comer y vuelve a checar. Todo lo demás se devuelve como "extras" en vez
 * de tirarlo, para que RH pueda ver que hubo movimiento raro en vez de que
 * desaparezca en silencio.
 *
 * Las checadas anuladas por RH no participan: para el cálculo, no existen.
 */
export const emparejarChecadas = (checadas = []) => {
  const vivas = checadas
    .filter((c) => c && !c.anulada)
    .slice()
    .sort((a, b) => new Date(a.marcadaEn) - new Date(b.marcadaEn));

  const entradas = vivas.filter((c) => c.tipo === "entrada");
  const salidas = vivas.filter((c) => c.tipo === "salida");

  const entrada = entradas[0] || null;
  const salida = salidas.length ? salidas[salidas.length - 1] : null;

  const extras = vivas.filter((c) => c !== entrada && c !== salida);

  return { entrada, salida, extras };
};

/**
 * Minutos entre la entrada y la salida.
 *
 * Se restan los timestamps absolutos, no las horas de reloj: así un turno que cruza la
 * medianoche (entra 22:00, sale 06:00) sale +8 h y no −16 h. Devuelve null si falta
 * alguna de las dos.
 */
export const minutosTrabajados = (entrada, salida) => {
  if (!entrada?.marcadaEn || !salida?.marcadaEn) return null;
  const ms = new Date(salida.marcadaEn) - new Date(entrada.marcadaEn);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
};

/**
 * Minutos de retardo respecto a la hora de entrada del horario (sin descontar la
 * tolerancia: la tolerancia decide SI es retardo, no CUÁNTO). Llegar antes da 0, no
 * un número negativo — nadie tiene "retardo de −5 minutos".
 */
export const minutosRetardo = (entrada, horario) => {
  if (!entrada?.marcadaEn || !horario?.horaEntrada) return 0;
  const llegada = minutosLocales(entrada.marcadaEn);
  const esperada = horaAMinutos(horario.horaEntrada);
  if (llegada == null || esperada == null) return 0;
  return Math.max(0, llegada - esperada);
};

/**
 * Clasifica un día. Este es el corazón del módulo.
 *
 * Orden de las reglas (importa):
 *  1. Sin horario ese día -> DESCANSO. La ausencia de renglón en `horarios` ES el
 *     descanso (migración 035); un domingo sin turno no puede ser falta.
 *  2. Con checadas -> se juzga lo que hizo (presente / retardo / incompleto). Un
 *     permiso aprobado NO borra el hecho de que vino: si vino, vino.
 *  3. Sin checadas y con permiso o vacación APROBADOS que cubran el día -> JUSTIFICADO.
 *     Solo los aprobados: un permiso pendiente todavía no justifica nada.
 *  4. Sin checadas y sin justificante -> FALTA.
 */
export const clasificarDia = ({
  fecha,
  checadas = [],
  horario = null,
  permisos = [],
  vacaciones = [],
} = {}) => {
  const { entrada, salida, extras } = emparejarChecadas(checadas);

  const justificacion =
    permisos.find((p) => p?.estado === "aprobado" && cubreFecha(fecha, p.fecha, p.fechaFin)) ||
    vacaciones.find((v) => v?.estado === "aprobado" && cubreFecha(fecha, v.fechaInicio, v.fechaFin)) ||
    null;

  const base = {
    fecha,
    entrada,
    salida,
    extras,
    justificacion,
    minutosTrabajados: minutosTrabajados(entrada, salida),
    minutosRetardo: 0,
  };

  if (!horario) {
    // Descanso. Si aun así checó (una guardia, un sábado que le tocó cubrir), los
    // minutos trabajados se conservan arriba: el día no cuenta como jornada, pero el
    // trabajo hecho no se borra del reporte.
    return { ...base, estado: ESTADOS_DIA.DESCANSO };
  }

  if (!entrada && !salida) {
    return {
      ...base,
      estado: justificacion ? ESTADOS_DIA.JUSTIFICADO : ESTADOS_DIA.FALTA,
    };
  }

  if (!salida) {
    // Entró y no cerró el día: se le olvidó checar la salida, o sigue dentro. En
    // cualquier caso no se puede calcular la jornada, y RH tiene que mirarlo.
    return { ...base, estado: ESTADOS_DIA.INCOMPLETO, minutosRetardo: minutosRetardo(entrada, horario) };
  }

  const retardo = minutosRetardo(entrada, horario);
  const tolerancia = Number.isFinite(horario.toleranciaMin) ? horario.toleranciaMin : 0;

  // Estrictamente mayor: entrar en el minuto exacto del límite de tolerancia NO es
  // retardo. Con 9:00 y 10 min de gracia, las 9:10 llegan a tiempo; las 9:11, no.
  const estado = retardo > tolerancia ? ESTADOS_DIA.RETARDO : ESTADOS_DIA.PRESENTE;

  return { ...base, estado, minutosRetardo: retardo };
};

/** Todas las fechas "YYYY-MM-DD" entre desde y hasta, ambas incluidas. */
export const rangoDeFechas = (desde, hasta) => {
  const fechas = [];
  if (!desde || !hasta) return fechas;

  const d = new Date(`${String(desde).slice(0, 10)}T00:00:00Z`);
  const fin = new Date(`${String(hasta).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(fin.getTime())) return fechas;

  while (d <= fin) {
    fechas.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return fechas;
};

/**
 * Construye la línea de días de un empleado en un rango.
 *
 * Recorre el CALENDARIO, no las checadas: una falta es precisamente un día sin
 * checadas, así que si se iterara sobre lo que hay en la tabla, las faltas serían
 * invisibles — que es el error clásico de un reporte de asistencia.
 */
export const construirDias = ({
  desde,
  hasta,
  checadas = [],
  horarios = [],
  permisos = [],
  vacaciones = [],
} = {}) => {
  const porFecha = new Map();
  for (const c of checadas) {
    const f = String(c?.fecha || "").slice(0, 10);
    if (!f) continue;
    if (!porFecha.has(f)) porFecha.set(f, []);
    porFecha.get(f).push(c);
  }

  const porDia = new Map(horarios.filter((h) => h).map((h) => [h.diaSemana, h]));

  return rangoDeFechas(desde, hasta).map((fecha) =>
    clasificarDia({
      fecha,
      checadas: porFecha.get(fecha) || [],
      horario: porDia.get(diaISO(fecha)) || null,
      permisos,
      vacaciones,
    })
  );
};

/**
 * "YYYY-MM-DD" -> Date a medianoche LOCAL (no UTC).
 *
 * getISOWeek() (constants.js) lee la fecha con los getters locales
 * (getFullYear/getMonth/getDate). Si se le pasa un Date creado a medianoche UTC, en
 * cualquier máquina al oeste de Greenwich —incluido México— esos getters devuelven el
 * DÍA ANTERIOR, y la semana sale corrida una entera. Construyendo la fecha con
 * componentes locales, lo que se le pasa es exactamente el día que se pretendía.
 */
const fechaLocal = (f) => {
  const [y, m, d] = String(f).slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Clave de agrupación de una fecha según la granularidad pedida. */
export const claveDe = (fecha, granularidad) => {
  const f = String(fecha).slice(0, 10);
  switch (granularidad) {
    case "semana":
      // Reusa el mismo cálculo de semana ISO que ya usan las encuestas y los KPIs, para
      // que "la semana 29" signifique lo mismo en todo el sistema.
      return getISOWeek(fechaLocal(f));
    case "mes":
      return f.slice(0, 7); // YYYY-MM
    case "anio":
      return f.slice(0, 4); // YYYY
    case "dia":
    default:
      return f;
  }
};

/** Cuenta y suma un conjunto de días ya clasificados. */
export const resumen = (dias = []) => {
  const r = {
    dias: dias.length,
    presentes: 0,
    retardos: 0,
    faltas: 0,
    justificados: 0,
    descansos: 0,
    incompletos: 0,
    minutosTrabajados: 0,
    minutosRetardo: 0,
    puntualidad: 0,
  };

  for (const d of dias) {
    if (d.estado === ESTADOS_DIA.PRESENTE) r.presentes += 1;
    else if (d.estado === ESTADOS_DIA.RETARDO) r.retardos += 1;
    else if (d.estado === ESTADOS_DIA.FALTA) r.faltas += 1;
    else if (d.estado === ESTADOS_DIA.JUSTIFICADO) r.justificados += 1;
    else if (d.estado === ESTADOS_DIA.DESCANSO) r.descansos += 1;
    else if (d.estado === ESTADOS_DIA.INCOMPLETO) r.incompletos += 1;

    r.minutosTrabajados += d.minutosTrabajados || 0;
    r.minutosRetardo += d.minutosRetardo || 0;
  }

  // Puntualidad sobre los días en que SE ESPERABA que viniera y vino. Los descansos y
  // los justificados no cuentan ni a favor ni en contra: castigar a alguien en su
  // porcentaje de puntualidad por tener vacaciones aprobadas sería absurdo.
  const juzgables = r.presentes + r.retardos + r.incompletos;
  r.puntualidad = juzgables ? Math.round((r.presentes / juzgables) * 100) : 0;

  return r;
};

/**
 * Agrupa los días por día / semana / mes / año, cada grupo con su resumen.
 * Es lo que alimenta el historial y los reportes. Devuelve orden cronológico.
 */
export const agruparPor = (dias = [], granularidad = "dia") => {
  const grupos = new Map();

  for (const d of dias) {
    const clave = claveDe(d.fecha, granularidad);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(d);
  }

  return [...grupos.entries()]
    .map(([clave, delGrupo]) => ({
      clave,
      dias: delGrupo,
      resumen: resumen(delGrupo),
    }))
    .sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));
};

/**
 * Minutos antes de la hora de salida en que se habilita la checada de salida.
 * DEBE coincidir con c_margen_salida de la RPC registrar_checada (migración 039). Si se
 * separan, la pantalla ofrecería un botón que el servidor va a rechazar.
 */
export const MARGEN_SALIDA_MIN = 10;

/**
 * ¿Puede ya registrar su salida?
 *
 * La regla la impone el servidor; esto solo existe para no ofrecerle un botón que va a
 * fallar. Sin horario ese día no hay hora contra la que comparar (alguien cubriendo un
 * turno que no es suyo): se permite.
 *
 * Devuelve también `disponibleDesde` para poder decirle a qué hora podrá, en vez de un
 * "no puedes" a secas que no le dice qué hacer.
 */
export const puedeRegistrarSalida = (horario, ahora = new Date()) => {
  if (!horario?.horaSalida) return { permitido: true, disponibleDesde: null };

  const salida = horaAMinutos(horario.horaSalida);
  if (salida == null) return { permitido: true, disponibleDesde: null };

  const desde = salida - MARGEN_SALIDA_MIN;
  const ahoraMin = minutosLocales(ahora instanceof Date ? ahora.toISOString() : ahora);
  if (ahoraMin == null) return { permitido: true, disponibleDesde: null };

  return {
    permitido: ahoraMin >= desde,
    disponibleDesde: minutosAHora(desde),
  };
};

/** ¿Esta checada merece que RH la mire? (fuera de la geocerca o sin poder comprobarla) */
export const requiereRevision = (checada) =>
  !!checada &&
  !checada.anulada &&
  (checada.ubicacionEstado === "fuera" || checada.ubicacionEstado === "sin_gps");
