import { describe, it, expect } from "vitest";
import {
  normalizarUsername,
  emailDeLogin,
  validarNombre,
  validarPuesto,
  validarUsername,
  validarTelefono,
  validarEmail,
  validarCumpleanos,
  validarFechaIngreso,
  validarFormularioUsuario,
} from "./validacionUsuario";

describe("normalizarUsername", () => {
  it("convierte espacios en puntos y baja a minúsculas", () => {
    expect(normalizarUsername("Ana Gomez")).toBe("ana.gomez");
  });

  // El servidor BORRA los acentos ("José" -> "Jos"); acá se convierten a su letra base
  // para que el usuario que se ve en pantalla sea el mismo con el que se entra.
  it("convierte los acentos a su letra base en vez de borrarlos", () => {
    expect(normalizarUsername("José Pérez")).toBe("jose.perez");
    expect(normalizarUsername("Muñoz")).toBe("munoz");
  });

  it("descarta los caracteres que el backend no acepta", () => {
    expect(normalizarUsername("ana!#$%gomez")).toBe("anagomez");
  });

  it("conserva punto, guion y guion bajo", () => {
    expect(normalizarUsername("ana_gomez-2.b")).toBe("ana_gomez-2.b");
  });

  it("colapsa varios espacios en un solo punto", () => {
    expect(normalizarUsername("  ana   gomez  ")).toBe("ana.gomez");
  });
});

describe("emailDeLogin", () => {
  it("arma el correo sintético con el username ya normalizado", () => {
    expect(emailDeLogin("José Pérez")).toBe("jose.perez@mcdental.internal");
  });
});

describe("validarNombre", () => {
  it("acepta un nombre con acentos y apóstrofos", () => {
    expect(validarNombre("José O'Connor")).toBeNull();
  });

  it("rechaza números", () => {
    expect(validarNombre("Ana 2")).toBe("El nombre no puede llevar números.");
  });

  it("rechaza símbolos", () => {
    expect(validarNombre("Ana@Gomez")).toBe("El nombre solo puede llevar letras.");
  });

  it("rechaza vacío y demasiado corto", () => {
    expect(validarNombre("")).toBe("El nombre es obligatorio.");
    expect(validarNombre("Al")).toBe("El nombre es demasiado corto.");
  });
});

describe("validarPuesto", () => {
  it("acepta un puesto normal", () => {
    expect(validarPuesto("Asistente Dental")).toBeNull();
  });

  it("rechaza números", () => {
    expect(validarPuesto("Recepcionista 2")).toBe("El puesto no puede llevar números.");
  });
});

describe("validarUsername", () => {
  it("acepta uno válido", () => {
    expect(validarUsername("ana.gomez")).toBeNull();
  });

  it("avisa si ya existe, comparando ya normalizado", () => {
    expect(validarUsername("Ana Gomez", { existentes: ["ana.gomez"] }))
      .toBe("Ya hay alguien con ese nombre de usuario.");
  });

  // Sin esto el backend recibía "@mcdental.internal" y devolvía un 400 genérico.
  it("rechaza uno que se quede sin ningún carácter válido", () => {
    expect(validarUsername("###")).toBe("Ese nombre de usuario no deja ningún carácter válido.");
  });

  it("rechaza el que queda demasiado corto tras normalizar", () => {
    expect(validarUsername("a!b")).toBe("El nombre de usuario es demasiado corto.");
  });
});

describe("validarTelefono", () => {
  it("es opcional", () => {
    expect(validarTelefono("")).toBeNull();
  });

  it("acepta formato con separadores", () => {
    expect(validarTelefono("+52 (833) 123-4567")).toBeNull();
  });

  it("rechaza letras", () => {
    expect(validarTelefono("833abc4567")).toBe("El teléfono solo puede llevar números.");
  });

  it("rechaza si tiene menos de 10 dígitos", () => {
    expect(validarTelefono("12345")).toBe("El teléfono debe tener al menos 10 dígitos.");
  });
});

describe("validarEmail", () => {
  it("es opcional", () => {
    expect(validarEmail("")).toBeNull();
  });

  it("acepta uno bien formado", () => {
    expect(validarEmail("ana@clinica.com")).toBeNull();
  });

  it("rechaza uno sin dominio", () => {
    expect(validarEmail("ana@clinica")).toBe("Ese correo no parece válido.");
  });
});

describe("validarCumpleanos", () => {
  it("es opcional", () => {
    expect(validarCumpleanos("")).toBeNull();
  });

  it("acepta MM-DD real", () => {
    expect(validarCumpleanos("08-25")).toBeNull();
  });

  it("acepta el 29 de febrero", () => {
    expect(validarCumpleanos("02-29")).toBeNull();
  });

  // El pattern del input dejaba pasar cualquier par de dígitos.
  it("rechaza mes y día imposibles", () => {
    expect(validarCumpleanos("99-99")).toBe("El mes tiene que estar entre 01 y 12.");
    expect(validarCumpleanos("02-30")).toBe("Ese día no existe en ese mes.");
    expect(validarCumpleanos("04-31")).toBe("Ese día no existe en ese mes.");
  });

  it("rechaza otro formato", () => {
    expect(validarCumpleanos("25/08")).toBe("Usá el formato MM-DD (por ejemplo 08-25).");
  });
});

describe("validarFechaIngreso", () => {
  it("es opcional", () => {
    expect(validarFechaIngreso("", "2026-07-25")).toBeNull();
  });

  it("acepta una fecha pasada y la de hoy", () => {
    expect(validarFechaIngreso("2020-01-15", "2026-07-25")).toBeNull();
    expect(validarFechaIngreso("2026-07-25", "2026-07-25")).toBeNull();
  });

  it("rechaza una fecha futura", () => {
    expect(validarFechaIngreso("2030-01-01", "2026-07-25"))
      .toBe("La fecha de ingreso no puede ser futura.");
  });
});

describe("validarFormularioUsuario", () => {
  const valido = {
    name: "Ana Gomez",
    user: "ana.gomez",
    puesto: "Recepcionista",
    telefono: "8331234567",
    email: "ana@clinica.com",
    fechaCumpleanos: "08-25",
    fechaIngreso: "2024-01-10",
  };

  it("no devuelve errores cuando todo está bien", () => {
    expect(validarFormularioUsuario(valido, { hoyISO: "2026-07-25" })).toEqual({});
  });

  it("junta los errores de todos los campos", () => {
    const errores = validarFormularioUsuario(
      { ...valido, name: "Ana 2", telefono: "abc", fechaCumpleanos: "99-99" },
      { hoyISO: "2026-07-25" }
    );
    expect(Object.keys(errores).sort()).toEqual(["fechaCumpleanos", "name", "telefono"]);
  });

  it("detecta el username duplicado", () => {
    const errores = validarFormularioUsuario(valido, {
      existentes: ["ana.gomez"],
      hoyISO: "2026-07-25",
    });
    expect(errores.user).toBe("Ya hay alguien con ese nombre de usuario.");
  });
});
