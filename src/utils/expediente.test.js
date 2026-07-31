import { describe, it, expect } from "vitest";
import { filtrarEmpleadosExpediente, estatusEmpleado, normalizarTexto } from "./expediente";

const empleados = [
  { id: 1, name: "Ana López", puesto: "Recepcionista", sucursal: "Clínica Centro" },
  { id: 2, name: "Bruno Martínez", puesto: "Doctor", sucursal: "Clínica Norte" },
  { id: 3, name: "Carla Ruiz", puesto: "Asistente dental", sucursal: "Clínica Centro" },
];

describe("normalizarTexto", () => {
  it("quita acentos y baja a minúsculas", () => {
    expect(normalizarTexto("López")).toBe("lopez");
    expect(normalizarTexto("  MARTÍNEZ ")).toBe("martinez");
  });

  it("no revienta con null o undefined", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
  });
});

describe("filtrarEmpleadosExpediente", () => {
  it("sin filtros devuelve a todos", () => {
    expect(filtrarEmpleadosExpediente(empleados)).toHaveLength(3);
  });

  it("encuentra un apellido acentuado escrito sin acento", () => {
    const r = filtrarEmpleadosExpediente(empleados, { busqueda: "lopez" });
    expect(r.map((e) => e.id)).toEqual([1]);
  });

  it("busca también por puesto", () => {
    const r = filtrarEmpleadosExpediente(empleados, { busqueda: "doctor" });
    expect(r.map((e) => e.id)).toEqual([2]);
  });

  it("la sucursal y el texto se suman, no se sustituyen", () => {
    // "Clínica Centro" tiene dos personas, pero solo una es recepcionista.
    const r = filtrarEmpleadosExpediente(empleados, {
      sucursal: "Clínica Centro",
      busqueda: "recepcionista",
    });
    expect(r.map((e) => e.id)).toEqual([1]);
  });

  it("una búsqueda sin resultados devuelve lista vacía, no todos", () => {
    expect(filtrarEmpleadosExpediente(empleados, { busqueda: "zzz" })).toEqual([]);
  });
});

describe("estatusEmpleado", () => {
  it("archivado gana sobre inactivo", () => {
    expect(estatusEmpleado({ archivado: true, inactivo: true }).texto).toBe("Archivado");
  });

  it("distingue inactivo de activo", () => {
    expect(estatusEmpleado({ inactivo: true }).texto).toBe("Inactivo");
    expect(estatusEmpleado({}).texto).toBe("Activo");
  });
});
