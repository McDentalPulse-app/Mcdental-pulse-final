import { describe, it, expect } from "vitest";
import {
  resolveFechaIngreso,
  resolveFechaCumpleanos,
  esEmpleadoActivo,
  formatFechaHoraClinica,
  calcularAntiguedad,
} from "./helpers";
import { normalizeEmployeeNameKey } from "./adminEmployeeDates";

// Fecha de ingreso a partir de "hace tantos años/meses/días" contados desde HOY, para no fijar
// una fecha de calendario que un año después haría fallar el test solo por el paso del tiempo.
const hace = ({ años = 0, meses = 0, dias = 0 }) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setMonth(d.getMonth() - meses);
  d.setFullYear(d.getFullYear() - años);
  return d.toISOString().slice(0, 10);
};

describe("calcularAntiguedad", () => {
  it("sin fecha, dice que no está registrada", () => {
    expect(calcularAntiguedad("")).toBe("No registrada");
    expect(calcularAntiguedad(null)).toBe("No registrada");
  });

  it("cuenta años, meses Y DÍAS exactos, no solo años y meses", () => {
    expect(calcularAntiguedad(hace({ meses: 3, dias: 3 }))).toBe("3 meses y 3 días");
  });

  it("un solo componente no lleva 'y'", () => {
    expect(calcularAntiguedad(hace({ dias: 5 }))).toBe("5 días");
    expect(calcularAntiguedad(hace({ años: 1 }))).toBe("1 año");
  });

  it("tres componentes: coma entre los dos primeros, 'y' antes del último", () => {
    expect(calcularAntiguedad(hace({ años: 2, meses: 1, dias: 10 }))).toBe("2 años, 1 mes y 10 días");
  });

  it("ingresó hoy mismo", () => {
    expect(calcularAntiguedad(hace({}))).toBe("Hoy");
  });

  it("una fecha de ingreso en el futuro no se cuenta como antigüedad", () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    expect(calcularAntiguedad(manana.toISOString().slice(0, 10))).toBe("No registrada");
  });
});

// Hasta ahora existía un override por nombre (ADMIN_EMPLOYEE_FECHAS) que pisaba a la
// base de datos para 14 empleados administrativos. Era PII dentro del código —y por
// tanto dentro del bundle público— y además tapaba que esas fechas nunca se habían
// guardado en la base. Ya están sincronizadas; estos tests fijan que la base es ahora
// la única fuente y que ningún nombre vuelve a decidir una fecha.
//
// Todos los nombres y fechas de aquí son INVENTADOS. Precisamente porque el nombre ya
// no decide nada, no hace falta —ni se debe— meter empleados reales en los tests.

describe("resolveFechaIngreso", () => {
  it("lee la fecha del usuario, que es lo que viene de la base", () => {
    expect(resolveFechaIngreso({ name: "EMPLEADA DE PRUEBA", fechaIngreso: "2024-03-01" })).toBe("2024-03-01");
  });

  it("el nombre ya no decide la fecha: sin dato en la base, no hay fecha", () => {
    // Antes, un nombre presente en el override devolvía su fecha aunque la base
    // estuviera vacía. Ahora no se inventa nada, venga el nombre que venga.
    expect(resolveFechaIngreso({ name: "PERSONA ADMINISTRATIVA" })).toBe("");
  });

  it("no revienta con un usuario nulo o incompleto", () => {
    expect(resolveFechaIngreso(null)).toBe("");
    expect(resolveFechaIngreso({})).toBe("");
  });
});

describe("resolveFechaCumpleanos", () => {
  it("prefiere fechaCumpleanos (MM-DD) cuando existe", () => {
    expect(resolveFechaCumpleanos({ fechaCumpleanos: "01-02", fechaNacimiento: "1990-11-30" })).toBe("01-02");
  });

  it("cae a fechaNacimiento (legacy de Firestore) y le quita el año", () => {
    expect(resolveFechaCumpleanos({ fechaNacimiento: "1990-11-30" })).toBe("11-30");
  });

  it("acepta un fechaNacimiento que ya venga en formato MM-DD", () => {
    expect(resolveFechaCumpleanos({ fechaNacimiento: "11-30" })).toBe("11-30");
  });

  it("ignora un fechaCumpleanos vacío o de solo espacios", () => {
    expect(resolveFechaCumpleanos({ fechaCumpleanos: "   ", fechaNacimiento: "1990-11-30" })).toBe("11-30");
  });

  it("el nombre ya no decide el cumpleaños", () => {
    expect(resolveFechaCumpleanos({ name: "PERSONA ADMINISTRATIVA" })).toBe("");
  });

  it("sin ninguna fecha devuelve cadena vacía", () => {
    expect(resolveFechaCumpleanos({})).toBe("");
    expect(resolveFechaCumpleanos(null)).toBe("");
  });
});

describe("normalizeEmployeeNameKey", () => {
  // Sigue vivo: lo usan psicologa.js y rh.js para identificar a la psicóloga y a RH
  // principales por nombre. Se queda aunque el override de fechas haya desaparecido.
  it("quita tildes, el prefijo LIC. y los espacios de más", () => {
    expect(normalizeEmployeeNameKey("LIC. Jose  Ramón Pérez")).toBe("JOSE RAMON PEREZ");
  });

  it("normaliza sin prefijo", () => {
    expect(normalizeEmployeeNameKey("maría  lópez soto")).toBe("MARIA LOPEZ SOTO");
  });

  // Rareza conocida, inofensiva: el prefijo "LIC." se quita con un ancla ^, y eso ocurre
  // ANTES del trim(). Si el nombre viene con espacios al principio, el ancla no casa y el
  // "LIC." sobrevive. No se corrige: los nombres de la base no traen espacios iniciales, y
  // los dos consumidores (psicologa.js, rh.js) comparan con includes(), así que les da igual.
  it("[rareza] con espacios al principio, el prefijo LIC. no se quita", () => {
    expect(normalizeEmployeeNameKey("  LIC. Jose Ramon Perez ")).toBe("LIC. JOSE RAMON PEREZ");
  });

  it("tolera nulos", () => {
    expect(normalizeEmployeeNameKey(null)).toBe("");
    expect(normalizeEmployeeNameKey(undefined)).toBe("");
  });
});

// El rol `doctor` nació después que este filtro y se quedó fuera: `esEmpleadoActivo`
// pedía role === "empleado" a secas. En producción eso borraba a 54 de las 99 personas
// de la plantilla en las 10 pantallas que lo usan (listas, dashboards, reportes RH,
// reconocimientos, descuentos, mensajes y AI Engine): se veían 45 empleados de ~100.
// Estos tests fijan que el doctor cuenta como plantilla y que gestión no.
describe("esEmpleadoActivo", () => {
  it("cuenta al empleado activo", () => {
    expect(esEmpleadoActivo({ role: "empleado", inactivo: false })).toBe(true);
  });

  it("cuenta al doctor: es un empleado con extras, no una categoría aparte", () => {
    expect(esEmpleadoActivo({ role: "doctor", inactivo: false })).toBe(true);
  });

  it("deja fuera a los roles de gestión, que no son plantilla", () => {
    expect(esEmpleadoActivo({ role: "admin" })).toBe(false);
    expect(esEmpleadoActivo({ role: "rh" })).toBe(false);
    expect(esEmpleadoActivo({ role: "psicologa" })).toBe(false);
  });

  it("deja fuera a los dados de baja, sea cual sea su rol", () => {
    expect(esEmpleadoActivo({ role: "empleado", inactivo: true })).toBe(false);
    expect(esEmpleadoActivo({ role: "doctor", inactivo: true })).toBe(false);
  });

  it("tolera nulos", () => {
    expect(esEmpleadoActivo(null)).toBe(false);
    expect(esEmpleadoActivo(undefined)).toBe(false);
    expect(esEmpleadoActivo({})).toBe(false);
  });
});

describe("formatFechaHoraClinica (timestamptz en hora de la clínica)", () => {
  // EL BUG QUE ESTO FIJA: un cambio guardado el 17 a las 19:00 en Monterrey (UTC-6) llega de
  // PostgREST como "2026-09-18T01:00:00+00:00". Recortar los 10 primeros caracteres —lo que
  // hace formatFechaCorta— da el día 18, o sea MAÑANA. En un sello de auditoría de dinero eso
  // es decir que la cuenta se cambió un día que no fue.
  //
  // CÓMO ESTÁN ESCRITAS ESTAS PRUEBAS, Y POR QUÉ. Una primera versión afirmaba lo mismo pero
  // no lo comprobaba: pasaba en verde con la línea `timeZone` BORRADA de la función, y también
  // con el cuerpo sustituido por una cadena constante. Dos motivos, los dos corregidos aquí:
  //
  //   1. La máquina donde se escribió está en la zona de la clínica, así que quitar `timeZone`
  //      no cambiaba nada localmente. Ahora las pruebas corren fijadas a UTC (ver el bloque
  //      `test` de vite.config.js), donde borrar la zona SÍ se nota.
  //   2. Se comparaba el resultado consigo mismo en otro formato. Ahora se fija la cadena
  //      EXACTA, y sobre TRES instantes que dan tres salidas distintas — una función que
  //      devuelva una constante no puede satisfacer las tres.
  it("ancla a la zona de la clínica: el instante decide el día y la hora mostrados", () => {
    // 01:00 UTC del 18 es todavía el 17 por la tarde en Monterrey (UTC-6): el caso que
    // formatFechaCorta mostraría como día 18.
    expect(formatFechaHoraClinica("2026-09-18T01:00:00+00:00")).toBe("17 sep 2026, 19:00");
    // En invierno el desfase es el mismo: Monterrey ya no cambia de horario desde 2022.
    expect(formatFechaHoraClinica("2026-01-05T14:30:00+00:00")).toBe("05 ene 2026, 08:30");
    // Y otro cruce de medianoche en el sentido contrario, un minuto antes.
    expect(formatFechaHoraClinica("2026-07-04T05:59:00+00:00")).toBe("03 jul 2026, 23:59");
  });

  it("da igual cómo venga escrito el instante: lo que cuenta es el momento", () => {
    // Mismo instante que el primer caso de arriba, escrito con offset en vez de en UTC. Sirve
    // para dos cosas: que el parseo del offset sea correcto, y —por ser `toBe` contra una
    // cadena exacta— también caza que se borre el anclaje de zona. Una versión anterior de
    // este comentario decía que esto «no prueba el anclaje»; era falso, y al comprobarlo
    // resultó ser una de las dos aserciones que sí lo cazan.
    expect(formatFechaHoraClinica("2026-09-17T19:00:00-06:00")).toBe("17 sep 2026, 19:00");
  });

  it("devuelve cadena vacía en lugar de «Invalid Date» con basura o vacío", () => {
    expect(formatFechaHoraClinica(null)).toBe("");
    expect(formatFechaHoraClinica(undefined)).toBe("");
    expect(formatFechaHoraClinica("")).toBe("");
    expect(formatFechaHoraClinica("no es fecha")).toBe("");
  });
});
