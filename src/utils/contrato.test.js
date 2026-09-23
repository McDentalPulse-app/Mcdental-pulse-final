import { describe, it, expect } from "vitest";
import {
  TIPOS_CONTRATO,
  datosContratoIniciales,
  clausulasContrato,
  domicilioTrabajador,
  formatFechaLarga,
  campo,
  money,
  RAYA,
} from "./contrato";

describe("datosContratoIniciales", () => {
  it("prellena solo lo que ya se sabe del empleado, el resto queda vacío", () => {
    const empleado = { name: "Ana Puntual", puesto: "Recepción", sucursal: "palmas", fechaIngreso: "2024-01-10", sueldoSemanal: 2100 };
    const d = datosContratoIniciales(empleado);
    expect(d.nombreTrabajador).toBe("Ana Puntual");
    expect(d.puesto).toBe("Recepción");
    expect(d.fechaIngreso).toBe("2024-01-10");
    expect(d.sueldoSemanal).toBe(2100);
    // Nada de RFC/CURP/domicilio: eso llega de la extracción, nunca inventado aquí.
    expect(d.curp).toBe("");
    expect(d.rfc).toBe("");
    expect(d.domicilioCalleNumero).toBe("");
  });

  it("tipo de contrato por defecto es indeterminado", () => {
    expect(datosContratoIniciales({}).tipoContrato).toBe(TIPOS_CONTRATO.INDETERMINADO);
  });

  it("sin datos del empleado no revienta, todo queda vacío", () => {
    const d = datosContratoIniciales();
    expect(d.nombreTrabajador).toBe("");
    expect(d.sueldoSemanal).toBeNull();
  });
});

describe("campo/money/formatFechaLarga", () => {
  it("campo() devuelve la raya cuando no hay dato real", () => {
    expect(campo("")).toBe(RAYA);
    expect(campo(null)).toBe(RAYA);
    expect(campo("   ")).toBe(RAYA);
    expect(campo("Ana Puntual")).toBe("Ana Puntual");
  });

  it("money() formatea un sueldo válido y raya un valor nulo o cero", () => {
    expect(money(2100)).toBe("$2,100.00");
    expect(money(null)).toBe(RAYA);
    expect(money(0)).toBe(RAYA);
    expect(money(undefined)).toBe(RAYA);
  });

  it("formatFechaLarga() en español y sin corrimiento de zona horaria", () => {
    expect(formatFechaLarga("2026-09-23")).toBe("23 de septiembre de 2026");
    expect(formatFechaLarga("")).toBe(RAYA);
    expect(formatFechaLarga(null)).toBe(RAYA);
  });
});

describe("domicilioTrabajador", () => {
  it("junta las partes con dato", () => {
    const d = { domicilioCalleNumero: "Calle 1 #23", domicilioColonia: "Centro", domicilioCP: "64000", domicilioCiudad: "Monterrey", domicilioEstado: "Nuevo León" };
    expect(domicilioTrabajador(d)).toBe("Calle 1 #23, Centro, 64000, Monterrey, Nuevo León");
  });

  it("sin ninguna parte, la raya", () => {
    expect(domicilioTrabajador({})).toBe(RAYA);
  });

  it("con partes parciales, solo junta las que hay", () => {
    expect(domicilioTrabajador({ domicilioCiudad: "Monterrey", domicilioEstado: "Nuevo León" })).toBe("Monterrey, Nuevo León");
  });
});

describe("clausulasContrato", () => {
  const base = datosContratoIniciales({ name: "Ana Puntual", puesto: "Recepción", sucursal: "palmas", fechaIngreso: "2024-01-10", sueldoSemanal: 2100 });

  it("son 11 cláusulas, cada una con título y texto", () => {
    const c = clausulasContrato(base);
    expect(c).toHaveLength(11);
    for (const cl of c) {
      expect(typeof cl.titulo).toBe("string");
      expect(typeof cl.texto).toBe("string");
      expect(cl.texto.length).toBeGreaterThan(0);
    }
  });

  it("la cláusula de salario refleja el sueldo capturado", () => {
    const c = clausulasContrato(base);
    const salario = c.find((cl) => cl.titulo.includes("QUINTA"));
    expect(salario.texto).toContain("$2,100.00");
  });

  it("tiempo indeterminado menciona el periodo a prueba del art. 39-A", () => {
    const c = clausulasContrato({ ...base, tipoContrato: TIPOS_CONTRATO.INDETERMINADO });
    const duracion = c.find((cl) => cl.titulo.includes("SEGUNDA"));
    expect(duracion.texto).toContain("TIEMPO INDETERMINADO");
    expect(duracion.texto).toContain("39-A");
  });

  it("tiempo determinado exige y usa la fecha de término", () => {
    const c = clausulasContrato({ ...base, tipoContrato: TIPOS_CONTRATO.DETERMINADO, fechaTermino: "2026-12-31" });
    const duracion = c.find((cl) => cl.titulo.includes("SEGUNDA"));
    expect(duracion.texto).toContain("TIEMPO DETERMINADO");
    expect(duracion.texto).toContain("31 de diciembre de 2026");
  });

  it("obra determinada usa la descripción de la obra, y sin ella deja la raya (no inventa)", () => {
    const c = clausulasContrato({ ...base, tipoContrato: TIPOS_CONTRATO.OBRA, descripcionObra: "Remodelación del consultorio 3" });
    const duracion = c.find((cl) => cl.titulo.includes("SEGUNDA"));
    expect(duracion.texto).toContain("OBRA DETERMINADA");
    expect(duracion.texto).toContain("Remodelación del consultorio 3");

    const sinDescripcion = clausulasContrato({ ...base, tipoContrato: TIPOS_CONTRATO.OBRA, descripcionObra: "" });
    expect(sinDescripcion.find((cl) => cl.titulo.includes("SEGUNDA")).texto).toContain(RAYA);
  });

  it("sin puesto capturado, la cláusula de objeto deja la raya en vez de inventar un puesto", () => {
    const c = clausulasContrato({ ...base, puesto: "" });
    expect(c.find((cl) => cl.titulo.includes("PRIMERA")).texto).toContain(RAYA);
  });
});
