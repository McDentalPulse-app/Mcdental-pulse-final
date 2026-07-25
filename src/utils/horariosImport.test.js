import { describe, it, expect } from "vitest";
import {
  normalizar,
  parsearDia,
  parsearHora,
  buscarEmpleado,
  analizarFilas,
  empleadosSinHorario,
} from "./horariosImport";

/** Plantilla de prueba. Datos inventados: nada de PII real (misma regla que helpers.test.js). */
const EMPLEADOS = [
  { id: "1", name: "Ana Pérez Gómez", inactivo: false },
  { id: "2", name: "Beto Núñez", inactivo: false },
  { id: "3", name: "Caro Ruiz", inactivo: false },
  { id: "4", name: "Ana Pérez Gómez", inactivo: false }, // ¡otra Ana igual! (pasa en empresas reales)
  { id: "5", name: "Dani Baja", inactivo: true },
];

const SIN_DUPLICADOS = EMPLEADOS.filter((e) => e.id !== "4");

describe("normalizar", () => {
  it("los acentos y las mayúsculas no distinguen a dos personas", () => {
    // Sin esto, media plantilla se queda sin emparejar por un acento — y alguien acabaría
    // "arreglándolo" a mano, metiéndole el horario a la persona equivocada.
    expect(normalizar("MARÍA  josé  PÉREZ")).toBe("maria jose perez");
    expect(normalizar("Núñez-Gómez")).toBe("nunez gomez");
  });
});

describe("parsearDia", () => {
  it.each([
    ["lunes", 1], ["LUNES", 1], ["Lun", 1], ["L", 1], ["monday", 1], [1, 1],
    ["martes", 2], ["M", 2],
    ["miércoles", 3], ["X", 3], ["mie", 3],
    ["sábado", 6], ["S", 6],
    ["domingo", 7], [7, 7],
  ])("%s => día %i", (valor, esperado) => {
    expect(parsearDia(valor)).toBe(esperado);
  });

  it("lo que no se entiende devuelve null, no un día al azar", () => {
    // Adivinar un día es meterle a alguien un turno el día que no era.
    expect(parsearDia("cuandosea")).toBeNull();
    expect(parsearDia("")).toBeNull();
    expect(parsearDia(9)).toBeNull();
  });
});

describe("parsearHora", () => {
  // Excel es un campo de minas: la misma columna trae texto, objetos Date y NÚMEROS (la
  // fracción del día), según quién escribiera cada fila.
  it.each([
    ["9:00", "09:00"],
    ["09:30", "09:30"],
    ["19:00", "19:00"],
    ["7:00 pm", "19:00"],
    ["7:00 p.m.", "19:00"],
    ["12:00 am", "00:00"],
    ["10h30", "10:30"],
    ["10", "10:00"],
  ])("texto %s => %s", (valor, esperado) => {
    expect(parsearHora(valor)).toBe(esperado);
  });

  it("Excel a veces da la hora como fracción del día", () => {
    expect(parsearHora(0.5)).toBe("12:00");        // mediodía
    expect(parsearHora(0.4166666666666667)).toBe("10:00");
  });

  it("Excel a veces da la hora como Date (con fecha de 1899, que da igual)", () => {
    expect(parsearHora(new Date(Date.UTC(1899, 11, 30, 10, 0)))).toBe("10:00");
  });

  it("lo que no es una hora devuelve null", () => {
    expect(parsearHora("mañana")).toBeNull();
    expect(parsearHora("25:00")).toBeNull();
    expect(parsearHora("10:99")).toBeNull();
    expect(parsearHora("")).toBeNull();
  });
});

describe("buscarEmpleado", () => {
  it("coincidencia exacta, aunque cambien acentos y mayúsculas", () => {
    const r = buscarEmpleado("ANA PEREZ GOMEZ", SIN_DUPLICADOS);
    expect(r.confianza).toBe("exacto");
    expect(r.empleado.id).toBe("1");
  });

  it("apellidos invertidos: coincide, pero se marca como PARCIAL", () => {
    // Es correcto el 99% de las veces. Esa otra vez es la que arruina el horario de alguien, y
    // por eso NO se escribe sin que un humano lo confirme.
    const r = buscarEmpleado("Pérez Gómez Ana", SIN_DUPLICADOS);
    expect(r.confianza).toBe("parcial");
    expect(r.empleado.id).toBe("1");
  });

  it("dos empleados con el mismo nombre => AMBIGUO, y no se elige a ninguno", () => {
    // Elegir al primero sería meterle el horario a una de las dos Anas a cara o cruz.
    const r = buscarEmpleado("Ana Pérez Gómez", EMPLEADOS);
    expect(r.confianza).toBe("ambiguo");
    expect(r.candidatos).toHaveLength(2);
    expect(r.empleado).toBeUndefined();
  });

  it("quien no está, no está", () => {
    expect(buscarEmpleado("Fulano de Tal", SIN_DUPLICADOS)).toBeNull();
  });
});

describe("analizarFilas", () => {
  const fila = (extra) => ({ nombre: "Ana Pérez Gómez", dia: "lunes", entrada: "10:00", salida: "19:00", ...extra });

  it("una fila buena sale válida, con su tolerancia por defecto", () => {
    const { validas, errores } = analizarFilas([fila()], SIN_DUPLICADOS);
    expect(errores).toHaveLength(0);
    expect(validas[0]).toMatchObject({
      diaSemana: 1, horaEntrada: "10:00", horaSalida: "19:00", toleranciaMin: 10, confianza: "exacto",
    });
    expect(validas[0].empleado.id).toBe("1");
  });

  it("las filas VACÍAS se ignoran, no son errores", () => {
    // Los Excel están llenos de ellas. Reportarlas como errores enterraría los de verdad.
    const { validas, errores } = analizarFilas([{}, { nombre: "" }, fila()], SIN_DUPLICADOS);
    expect(validas).toHaveLength(1);
    expect(errores).toHaveLength(0);
  });

  it("un empleado que NO existe no se importa: se reporta", () => {
    const { validas, errores } = analizarFilas([fila({ nombre: "Fulano" })], SIN_DUPLICADOS);
    expect(validas).toHaveLength(0);
    expect(errores[0].motivo).toContain("No hay ningún empleado activo");
  });

  it("un empleado DADO DE BAJA no cuenta como empleado", () => {
    const { errores } = analizarFilas([fila({ nombre: "Dani Baja" })], EMPLEADOS);
    expect(errores[0].motivo).toContain("No hay ningún empleado activo");
  });

  it("la salida no puede ser anterior a la entrada", () => {
    // Los turnos nocturnos no están soportados (migración 035), así que esto es un error de
    // captura, no un caso raro que haya que aceptar.
    const { validas, errores } = analizarFilas([fila({ entrada: "19:00", salida: "10:00" })], SIN_DUPLICADOS);
    expect(validas).toHaveLength(0);
    expect(errores[0].motivo).toContain("no puede ser anterior");
  });

  it("el mismo empleado y día DOS VECES: la segunda se rechaza, no se pisa en silencio", () => {
    // La tabla tiene un índice único (empleado, día). Sin este aviso, la segunda fila pisaría a
    // la primera y nadie sabría cuál de los dos horarios quedó.
    const { validas, errores } = analizarFilas([fila(), fila({ entrada: "08:00" })], SIN_DUPLICADOS);
    expect(validas).toHaveLength(1);
    expect(validas[0].horaEntrada).toBe("10:00"); // manda la primera
    expect(errores[0].motivo).toContain("ya tiene un horario para ese día");
  });

  it("la línea del error es la que el usuario ve en Excel (con cabecera)", () => {
    // Decirle "error en la fila 0" a alguien que está mirando su Excel es no decirle nada.
    const { errores } = analizarFilas([fila(), fila({ nombre: "Fulano" })], SIN_DUPLICADOS);
    expect(errores[0].linea).toBe(3); // 1ª fila de datos = línea 2, la segunda = línea 3
  });

  it("una tolerancia absurda se rechaza", () => {
    const { errores } = analizarFilas([fila({ tolerancia: 500 })], SIN_DUPLICADOS);
    expect(errores[0].motivo).toContain("entre 0 y 120");
  });
});

describe("empleadosSinHorario", () => {
  it("dice a quién se olvidaron de poner en el Excel", () => {
    // Un empleado sin horario no da error: simplemente no tiene turno, y el sistema lo tratará
    // como descanso TODOS los días. Es un silencio peligroso, así que se dice en voz alta.
    const { validas } = analizarFilas(
      [{ nombre: "Ana Pérez Gómez", dia: "lunes", entrada: "10:00", salida: "19:00" }],
      SIN_DUPLICADOS
    );
    const olvidados = empleadosSinHorario(validas, SIN_DUPLICADOS);
    expect(olvidados.map((e) => e.name)).toEqual(["Beto Núñez", "Caro Ruiz"]);
  });
});
