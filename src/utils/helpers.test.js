import { describe, it, expect } from "vitest";
import { resolveFechaIngreso, resolveFechaCumpleanos, esEmpleadoActivo } from "./helpers";
import { normalizeEmployeeNameKey } from "./adminEmployeeDates";

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
