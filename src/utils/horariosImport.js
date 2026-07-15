import { horaAMinutos } from "./asistencia";

/**
 * Importación de horarios desde un Excel.
 *
 * LA REGLA QUE MANDA: NUNCA IMPORTAR A CIEGAS.
 *
 * El Excel de una empresa real trae nombres mal escritos, filas en blanco, horas guardadas como
 * texto, gente que ya no trabaja aquí y celdas combinadas. Un import silencioso que "casi
 * acierta" es PEOR que no tener importador: deja horarios equivocados que luego generan
 * retardos falsos, y nadie sabe de dónde salieron.
 *
 * Por eso aquí no se importa nada: se ANALIZA. Este módulo convierte las filas crudas en
 * "esto es válido" y "esto no, y por esto". Lo que se hace con eso lo decide una persona
 * mirando la previsualización.
 *
 * Todo es puro: entra data, sale data. Sin React y sin Supabase — es lo único de este módulo
 * que se puede testear.
 */

/** Los días, como suele escribirlos la gente en un Excel. ISO: 1=lunes … 7=domingo. */
const DIAS = {
  lunes: 1, lun: 1, l: 1, monday: 1, mon: 1, "1": 1,
  martes: 2, mar: 2, m: 2, tuesday: 2, tue: 2, "2": 2,
  miercoles: 3, mier: 3, mie: 3, x: 3, wednesday: 3, wed: 3, "3": 3,
  jueves: 4, jue: 4, j: 4, thursday: 4, thu: 4, "4": 4,
  viernes: 5, vie: 5, v: 5, friday: 5, fri: 5, "5": 5,
  sabado: 6, sab: 6, s: 6, saturday: 6, sat: 6, "6": 6,
  domingo: 7, dom: 7, d: 7, sunday: 7, sun: 7, "7": 7,
};

/**
 * Quita acentos, mayúsculas y espacios de más.
 *
 * "MARÍA  josé  PÉREZ" y "maria jose perez" son la misma persona. Sin esto, media plantilla se
 * quedaría sin emparejar por un acento — y peor: alguien acabaría "arreglándolo" a mano y
 * metiéndole el horario a la persona equivocada.
 */
export const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    // ̀-ͯ son los acentos, ya separados de su letra por el normalize("NFD").
    // Escrito con escapes y no con los caracteres literales: un acento suelto en el código
    // fuente es invisible al revisar un diff y cualquier editor puede comérselo.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Día ISO a partir de lo que sea que hayan escrito. null si no se entiende. */
export const parsearDia = (valor) => {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number" && valor >= 1 && valor <= 7) return valor;
  return DIAS[normalizar(valor).replace(/\s/g, "")] ?? null;
};

/**
 * Una hora, venga como venga.
 *
 * Excel es un campo de minas con las horas: a veces son texto ("9:00", "09:00 a.m."), a veces
 * un objeto Date, y a veces un NÚMERO — la fracción del día (0.5 = mediodía). Las tres formas
 * conviven en el mismo archivo, en la misma columna, según quién escribiera cada fila.
 */
export const parsearHora = (valor) => {
  if (valor == null || valor === "") return null;

  // Excel a veces entrega la hora como Date (con la fecha en 1899, que no importa).
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const h = String(valor.getUTCHours()).padStart(2, "0");
    const m = String(valor.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  // Y a veces como fracción del día: 0.5 = las 12:00.
  if (typeof valor === "number") {
    if (valor < 0 || valor >= 1) return null;
    const total = Math.round(valor * 24 * 60);
    const h = String(Math.floor(total / 60)).padStart(2, "0");
    const m = String(total % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  const texto = String(valor).trim().toLowerCase();
  const m = texto.match(/^(\d{1,2})[:.h]?(\d{2})?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return null;

  let horas = Number(m[1]);
  const minutos = Number(m[2] || 0);
  const sufijo = (m[3] || "").replace(/\./g, "");

  if (sufijo === "pm" && horas < 12) horas += 12;
  if (sufijo === "am" && horas === 12) horas = 0;

  if (horas > 23 || minutos > 59) return null;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
};

/**
 * Busca al empleado por nombre, tolerando cómo lo escribieron.
 *
 * ESTE ES EL PUNTO PELIGROSO DE TODO EL IMPORTADOR. Meterle el horario a la persona equivocada
 * por un apellido invertido es un error silencioso que nadie va a detectar hasta que empiecen a
 * salir retardos de alguien que llegó puntual.
 *
 * Por eso devuelve el nivel de confianza, y NADA se escribe sin que un humano lo confirme:
 *   - "exacto": el nombre normalizado coincide entero.
 *   - "parcial": coinciden todas las palabras pero en otro orden ("Pérez María" / "María Pérez").
 *   - "ambiguo": encaja con varios empleados. NO se elige: se le pregunta a la persona.
 *   - null: no se encontró.
 */
export const buscarEmpleado = (nombre, empleados) => {
  const buscado = normalizar(nombre);
  if (!buscado) return null;

  const exacto = empleados.filter((e) => normalizar(e.name) === buscado);
  if (exacto.length === 1) return { empleado: exacto[0], confianza: "exacto" };
  if (exacto.length > 1) return { candidatos: exacto, confianza: "ambiguo" };

  // Mismas palabras, otro orden: "Pérez Gómez María" vs "María Pérez Gómez".
  const palabras = new Set(buscado.split(" "));
  const parcial = empleados.filter((e) => {
    const suyas = new Set(normalizar(e.name).split(" "));
    if (palabras.size !== suyas.size) return false;
    return [...palabras].every((p) => suyas.has(p));
  });

  if (parcial.length === 1) return { empleado: parcial[0], confianza: "parcial" };
  if (parcial.length > 1) return { candidatos: parcial, confianza: "ambiguo" };

  return null;
};

/**
 * Analiza las filas del Excel contra la plantilla real.
 *
 * `filas` son objetos con las claves ya mapeadas por el admin:
 *   { nombre, dia, entrada, salida, tolerancia }
 *
 * Devuelve { validas, errores }. Las válidas llevan el empleado ya resuelto y la confianza del
 * emparejamiento — porque una coincidencia "parcial" es correcta el 99% de las veces, y esa
 * otra vez es la que arruina el horario de alguien.
 */
export const analizarFilas = (filas = [], empleados = []) => {
  const activos = empleados.filter((e) => !e.inactivo);

  const validas = [];
  const errores = [];

  filas.forEach((fila, i) => {
    const linea = i + 2; // +1 por el índice, +1 por la cabecera: es la fila que ve en Excel
    const nombre = String(fila.nombre ?? "").trim();

    // Una fila totalmente vacía no es un error: los Excel están llenos de ellas.
    if (!nombre && !fila.dia && !fila.entrada && !fila.salida) return;

    if (!nombre) {
      errores.push({ linea, fila, motivo: "Falta el nombre del empleado." });
      return;
    }

    const encontrado = buscarEmpleado(nombre, activos);

    if (!encontrado) {
      errores.push({ linea, fila, motivo: `No hay ningún empleado activo llamado "${nombre}".` });
      return;
    }
    if (encontrado.confianza === "ambiguo") {
      errores.push({
        linea,
        fila,
        motivo: `"${nombre}" encaja con varios empleados: ${encontrado.candidatos.map((c) => c.name).join(", ")}. Corrige el Excel para que no haya duda.`,
      });
      return;
    }

    const dia = parsearDia(fila.dia);
    if (dia == null) {
      errores.push({ linea, fila, motivo: `No se entiende el día "${fila.dia}".` });
      return;
    }

    const entrada = parsearHora(fila.entrada);
    const salida = parsearHora(fila.salida);

    if (!entrada) {
      errores.push({ linea, fila, motivo: `No se entiende la hora de entrada "${fila.entrada}".` });
      return;
    }
    if (!salida) {
      errores.push({ linea, fila, motivo: `No se entiende la hora de salida "${fila.salida}".` });
      return;
    }

    // Un turno que "termina" antes de empezar es un dato imposible. Los turnos nocturnos no
    // están soportados (ver migración 035), así que esto es un error de captura, no un caso raro.
    if (horaAMinutos(salida) <= horaAMinutos(entrada)) {
      errores.push({
        linea,
        fila,
        motivo: `La salida (${salida}) no puede ser anterior o igual a la entrada (${entrada}).`,
      });
      return;
    }

    const tolerancia = fila.tolerancia == null || fila.tolerancia === ""
      ? 10
      : Number(fila.tolerancia);

    if (!Number.isFinite(tolerancia) || tolerancia < 0 || tolerancia > 120) {
      errores.push({ linea, fila, motivo: `La tolerancia "${fila.tolerancia}" no es un número entre 0 y 120.` });
      return;
    }

    validas.push({
      linea,
      empleado: encontrado.empleado,
      confianza: encontrado.confianza,
      nombreEnExcel: nombre,
      diaSemana: dia,
      horaEntrada: entrada,
      horaSalida: salida,
      toleranciaMin: Math.round(tolerancia),
    });
  });

  // Un empleado y un día no pueden salir dos veces: la tabla tiene un índice único
  // (uq_horarios_empleado_dia) y el segundo pisaría al primero en silencio. Mejor decirlo.
  const vistos = new Map();
  const sinDuplicados = [];

  for (const v of validas) {
    const clave = `${v.empleado.id}|${v.diaSemana}`;
    if (vistos.has(clave)) {
      errores.push({
        linea: v.linea,
        fila: {},
        motivo: `${v.empleado.name} ya tiene un horario para ese día en la línea ${vistos.get(clave)}. Uno de los dos sobra.`,
      });
      continue;
    }
    vistos.set(clave, v.linea);
    sinDuplicados.push(v);
  }

  return { validas: sinDuplicados, errores };
};

/** Cuántos empleados de la plantilla NO aparecen en el Excel (se quedarían sin horario). */
export const empleadosSinHorario = (validas, empleados) => {
  const conHorario = new Set(validas.map((v) => v.empleado.id));
  return empleados.filter((e) => !e.inactivo && !conHorario.has(e.id));
};
