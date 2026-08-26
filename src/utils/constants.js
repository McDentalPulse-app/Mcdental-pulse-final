export const SUCURSALES = ["Oficina Administrativa", "McDental Palmas", "McDental Madero", "McDental Tampico", "McDental Tampico Obregon", "Popular Tampico", "McDental Tuxpan", "Popular Tuxpan", "McDental Poza Rica", "Popular Poza Rica", "McDental Valles", "McDental Irapuato", "Popular Irapuato", "McDental Victoria", "McDental Reynosa", "McDental Pachuca", "McDental Hermosillo", "McDental Villahermosa", "McDental Huejutla", "McDental Altamira", "McDental Ebano", "Popular Reynosa", "McDental Mante", "McDental Leon", "Martinez De La Torre"];

const SUCURSAL_ALIASES = {
  "Oficina Central": "Oficina Administrativa",
  Central: "Oficina Administrativa",
};

/** Nombre canónico para mostrar (compatibilidad con datos legacy). */
export const normalizeSucursal = (sucursal) => {
  if (!sucursal) return sucursal || "";
  return SUCURSAL_ALIASES[sucursal] || sucursal;
};

/** Comparar sucursales tratando alias legacy como la misma. */
export const sucursalMatches = (a, b) => normalizeSucursal(a) === normalizeSucursal(b);

/**
 * Cómo se nombra cada rol de cara al personal. Se usa para firmar los avisos ("Lic. Mario
 * Ruiz · Administración"): un empleado no tiene por qué saber qué significa "psicologa".
 */
export const ETIQUETA_ROL = {
  admin: "Administración",
  rh: "Recursos Humanos",
  psicologa: "Psicología",
  doctor: "Doctor",
  empleado: "Empleado",
};

export const etiquetaRol = (rol) => ETIQUETA_ROL[rol] || "";

/** Semana legacy del piloto; se trata como la semana activa en lectura. */
export const LEGACY_LAUNCH_WEEK = "2025-W15";

/**
 * Semana ISO-8601 ("YYYY-Www") de una fecha. Las semanas empiezan el LUNES;
 * el corte es la medianoche local del lunes (00:00). Calcula sobre la fecha
 * local, así la encuesta se reinicia cada lunes a las 12 am hora local.
 */
export const getISOWeek = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // lunes=1 … domingo=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // jueves de esta semana ISO
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

/** Semana activa del sistema (clave interna ISO; encuestas nuevas, KPIs, reinicio).
 *  Live binding: refreshSemana() lo actualiza al cruzar el lunes, sin recargar. */
export let semanaActual = getISOWeek();

/** Semana ISO del lanzamiento real (primera semana en que se aplican encuestas) = W1.
 *  Fija: la próxima semana será W2, y así sucesivamente. */
export const LAUNCH_WEEK = "2026-W27";

/**
 * Lunes (UTC) de una semana ISO "YYYY-Www".
 *
 * ANCLA EN EL 4 DE ENERO, que por definición cae siempre en la semana ISO 1. Antes anclaba en
 * el 1 de enero y eso rompía en el cambio de año: "2026-W53" y "2027-W01" devolvían el MISMO
 * lunes (2026-12-28), así que `semanaNumero` les daba a las dos n=27, y de ahí en adelante la
 * numeración iba corrida una semana respecto a lo que etiqueta `getISOWeek` — que sí usa la
 * regla del jueves.
 *
 * No era cosmético: el emparejamiento quincenal de la encuesta depende de la PARIDAD de
 * `semanaNumero`, así que con la numeración corrida, en el cambio de año se emparejarían las
 * semanas equivocadas y un bloque de preguntas se repetiría o se saltaría.
 *
 * `rangoDeSemana`, más abajo en este mismo archivo, ya anclaba así. Ahora coinciden.
 */
export const isoWeekToMonday = (week) => {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(week ?? "").trim());
  if (!m) return null;
  const [, year, wk] = m;
  const cuatroEnero = new Date(Date.UTC(Number(year), 0, 4));
  const lunesW1 = new Date(cuatroEnero);
  lunesW1.setUTCDate(cuatroEnero.getUTCDate() - ((cuatroEnero.getUTCDay() || 7) - 1));
  const lunes = new Date(lunesW1);
  lunes.setUTCDate(lunesW1.getUTCDate() + (Number(wk) - 1) * 7);
  return lunes;
};

/** Número de semana relativo al lanzamiento (W1, W2, …). null si es anterior. */
export const semanaNumero = (week) => {
  const a = isoWeekToMonday(week);
  const b = isoWeekToMonday(LAUNCH_WEEK);
  if (!a || !b) return null;
  const n = Math.round((a - b) / (7 * 86400000)) + 1;
  return n >= 1 ? n : null;
};

/**
 * La semana ISO que hace el número `n` desde el lanzamiento. Inversa de `semanaNumero()`.
 *
 * HACE SU PROPIA CUENTA EN UTC en vez de reusar `getISOWeek()`, y no es por gusto: `getISOWeek`
 * lee la fecha con los getters LOCALES, mientras `isoWeekToMonday()` devuelve medianoche UTC.
 * Pasar una a la otra en una zona al oeste de Greenwich —aquí, UTC-6— cae en el DOMINGO
 * anterior, y con él en la semana de antes. El test de ida y vuelta de
 * `constants.periodoQuincenal.test.js` vigila justo eso, 160 semanas seguidas.
 */
export const semanaDesdeNumero = (n) => {
  const base = isoWeekToMonday(LAUNCH_WEEK);
  if (!base || !Number.isInteger(n) || n < 1) return null;
  // El JUEVES decide a qué año ISO pertenece la semana, igual que en getISOWeek.
  const jueves = new Date(base.getTime() + ((n - 1) * 7 + 3) * 86400000);
  const anio = jueves.getUTCFullYear();
  const numero = Math.ceil(((jueves.getTime() - Date.UTC(anio, 0, 1)) / 86400000 + 1) / 7);
  return `${anio}-W${String(numero).padStart(2, "0")}`;
};

/** Normaliza semana guardada: solo rellena vacías con la activa. Conserva la
 *  semana real (incluida la legacy del piloto) para no falsear el orden/historial. */
export const normalizeWeek = (week) => {
  if (week == null || String(week).trim() === "") return semanaActual;
  return week;
};

/**
 * ¿La encuesta pertenece a la semana activa? Compara la semana exacta tagueada
 * al enviar (no remapea legacy/vacías), para que solo cuente la encuesta real
 * de esta semana y el reinicio del lunes funcione.
 */
export const isSemanaActual = (week) => String(week ?? "").trim() === getISOWeek();

/** Año del lanzamiento, prefijo de las etiquetas ("2026-W1", "2026-W2", …). */
const LAUNCH_YEAR = LAUNCH_WEEK.slice(0, 4);

/** Semana para mostrar en UI: del lanzamiento en adelante numera "2026-W01",
 *  "2026-W02", … Todas las semanas anteriores al lanzamiento (legacy 2025 y
 *  pilotos 2026 previos) se juntan bajo una sola etiqueta "2026-W00". */
export const formatSemanaDisplay = (week) => {
  const w = normalizeWeek(week);
  const n = semanaNumero(w);
  return n ? `${LAUNCH_YEAR}-W${String(n).padStart(2, "0")}` : `${LAUNCH_YEAR}-W00`;
};

/** Etiqueta de la semana activa para encabezados ("2026-W01", …). Live binding. */
export let semanaDisplay = formatSemanaDisplay(semanaActual);

/**
 * EL PERÍODO DE LA ENCUESTA. Es el concepto que se está separando de «semana».
 *
 * POR QUÉ EXISTE: «semana» significa DOS cosas en este código y hasta ahora compartían el
 * mismo nombre. La de la ENCUESTA —cada cuánto se contesta, con qué clave se guarda, cuándo
 * se reinicia— y la de ASISTENCIA y HORARIOS, que es la semana natural de trabajo y no cambia
 * nunca. `getISOWeek` alimenta a las dos (asistencia.js la usa en construirDias), así que
 * redefinirla para volver la encuesta quincenal dejaría a la asistencia clasificando los días
 * en el período equivocado.
 *
 * HOY EL PERÍODO ES LA SEMANA, igual que siempre (ver PRIMER_PERIODO_QUINCENAL abajo). La
 * separación se conserva porque el concepto sigue siendo distinto: si la encuesta vuelve a
 * cambiar de cadencia, se toca aquí y la asistencia no se entera.
 *
 * `claveDelPeriodo()` es función y no live binding a propósito: es lo que se ESCRIBE en
 * `encuestas.semana`, y calcularlo en el momento del envío es lo que hacía `getISOWeek()`
 * antes. Con un live binding, una app abierta desde antes del lunes guardaría la clave vieja
 * hasta que el timer de App la refrescara.
 */

/**
 * Primera semana en que la encuesta sería QUINCENAL. `null` = NUNCA: la encuesta es SEMANAL.
 *
 * POR QUÉ ESTÁ APAGADO (2026-08-17). Del 10 al 16 de agosto estuvo en "2026-W33" y la encuesta
 * se pidió cada 15 días. Fue un requisito mal entendido: el dueño pidió que rotaran cada 15
 * días LAS PREGUNTAS del bloque, no que la encuesta se contestara cada 15 días. La rotación de
 * bloques (`quincenaNumero`, ceil(n/2) en encuestaBloques.js) NO se tocó y sigue siendo
 * quincenal — o sea que el mismo bloque sale dos semanas seguidas, y eso es lo que se quiere.
 *
 * Se revirtió un lunes y antes de que nadie contestara la semana nueva: las 76 encuestas de
 * W33 se habían contestado todas dentro de esa semana, así que ninguna quedó mal atribuida y
 * nadie tuvo que contestar dos veces. Si algún día se vuelve a encender, elegir la fecha con
 * ese mismo criterio.
 *
 * SI SE ENCIENDE: tiene que ser la PRIMERA semana de su quincena (número impar desde el
 * lanzamiento), o el corte parte un par por la mitad. Hay un test que lo vigila. Y hay que
 * cambiar TAMBIÉN el gemelo de api/tareas-programadas.js, o el servidor manda recordatorios
 * por una encuesta ya entregada.
 */
export const PRIMER_PERIODO_QUINCENAL = null;

/**
 * La clave de período a la que pertenece una semana ISO.
 *
 * HOY NO AGRUPA NADA: con el corte apagado devuelve la semana tal cual, que es la cadencia de
 * siempre. El emparejamiento de abajo solo se enciende si alguien vuelve a poner una fecha de
 * corte, y entonces los pares serían LOS MISMOS que usa la rotación de bloques
 * (`quincenaNumero`, ceil(n/2)).
 */
export const claveDePeriodo = (week) => {
  const w = String(week ?? "").trim();
  const n = semanaNumero(w);
  const nCorte = semanaNumero(PRIMER_PERIODO_QUINCENAL);
  // Pilotos anteriores al lanzamiento (n == null) y todo lo previo al corte: la clave es la
  // semana tal cual. Es D2: lo ya guardado sigue significando lo mismo.
  if (n == null || nCorte == null || n < nCorte) return w;
  // Quincenal: la primera semana del par se representa a sí misma; la segunda apunta a ella.
  return n % 2 === 1 ? w : (semanaDesdeNumero(n - 1) ?? w);
};

/** La clave con la que se guarda una encuesta nueva. */
export const claveDelPeriodo = () => claveDePeriodo(getISOWeek());

/**
 * ¿Esa clave de periodo cubre DOS semanas o una?
 *
 * Hace falta para hablar de ella en voz alta: una clave posterior al corte es una quincena y dura
 * 14 días, y una anterior es una semana y dura 7. Sin esto, cualquier pantalla que quiera decir
 * «del día tal al día tal» tiene que volver a comparar contra la constante por su cuenta.
 */
export const esPeriodoQuincenal = (clave) => {
  const n = semanaNumero(String(clave ?? "").trim());
  const nCorte = semanaNumero(PRIMER_PERIODO_QUINCENAL);
  return n != null && nCorte != null && n >= nCorte;
};

export let periodoActual = claveDePeriodo(semanaActual);

/** Etiqueta del período activo para encabezados. Live binding, igual que semanaDisplay. */
export let periodoDisplay = formatSemanaDisplay(periodoActual);

/**
 * ¿Esa encuesta es la del período en curso? (o sea: ¿ya contestó?)
 *
 * Normaliza LAS DOS PARTES antes de comparar, en vez de exigir igualdad exacta con la clave
 * actual. El caso real que cubre: un teléfono con el bundle viejo en caché manda
 * `semana: getISOWeek()`, que en la segunda semana de la quincena es W34 y no W33. Con
 * igualdad exacta, el portón no lo reconocería, la app le volvería a pedir la encuesta, y se
 * guardaría una segunda fila con clave W33 — dos encuestas en la misma quincena, sin que el
 * `unique` lo impida porque las claves difieren.
 */
export const esPeriodoActual = (clave) => {
  const c = String(clave ?? "").trim();
  return c !== "" && claveDePeriodo(c) === claveDelPeriodo();
};

/** Recalcula la semana activa. Si cambió (cruzó el lunes), actualiza los live
 *  bindings y devuelve true. Lo invoca un timer en App para refrescar sin recargar. */
export const refreshSemana = () => {
  const w = getISOWeek();
  if (w === semanaActual) return false;
  semanaActual = w;
  semanaDisplay = formatSemanaDisplay(w);
  // El período de la encuesta sigue por ahora a la semana: si se refrescara uno y no el otro,
  // el empleado vería el encabezado de una semana con la encuesta de la anterior.
  periodoActual = claveDePeriodo(semanaActual);
  periodoDisplay = formatSemanaDisplay(periodoActual);
  return true;
};

/**
 * Lunes y sábado que cubre una CLAVE DE PERIODO: los de su semana si es semanal, y hasta el
 * sábado de la segunda si es quincenal.
 *
 * Existe porque `rangoDeSemana` siempre devuelve 6 días, y desde el corte quincenal el tablero de
 * RH pintaba «10 – 15 ago» para un periodo que llega al 22: la mitad del periodo se veía fuera de
 * su propio rango.
 */
export const rangoDePeriodo = (clave) => {
  const id = claveDePeriodo(clave);
  const r = rangoDeSemana(id);
  if (!r) return null;
  if (!esPeriodoQuincenal(id)) return r;
  const sabado = new Date(`${r.hasta}T00:00:00Z`);
  sabado.setUTCDate(sabado.getUTCDate() + 7);
  return { desde: r.desde, hasta: sabado.toISOString().slice(0, 10) };
};

/** Lunes y sábado de una semana ISO "YYYY-Www". La clínica trabaja de lunes a sábado. */
export const rangoDeSemana = (semana) => {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(semana || ""));
  if (!m) return null;
  const [, anio, sem] = m;
  // El 4 de enero siempre cae en la semana ISO 1: es la forma estándar de anclar el cálculo.
  const cuatroEnero = new Date(Date.UTC(Number(anio), 0, 4));
  const lunesW1 = new Date(cuatroEnero);
  lunesW1.setUTCDate(cuatroEnero.getUTCDate() - ((cuatroEnero.getUTCDay() || 7) - 1));
  const lunes = new Date(lunesW1);
  lunes.setUTCDate(lunesW1.getUTCDate() + (Number(sem) - 1) * 7);
  const sabado = new Date(lunes);
  sabado.setUTCDate(lunes.getUTCDate() + 5);
  return { desde: lunes.toISOString().slice(0, 10), hasta: sabado.toISOString().slice(0, 10) };
};
