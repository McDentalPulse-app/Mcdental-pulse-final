import { describe, it, expect } from "vitest";
import { rutaSegura, mimeDeArchivo, formatoPeso, etiquetaTipo } from "./archivo";

/**
 * Estas dos funciones son las que tumbaron la primera subida real a un expediente
 * (2026-08-03): la ruta se cortó por un espacio del nombre y el almacén rechazó el archivo
 * con 415 porque llegó como `application/octet-stream`.
 */
describe("rutaSegura", () => {
  it("quita los espacios, que son lo que corta la URL de subida", () => {
    expect(rutaSegura("Actividades Erick Torres 29_04 Junio_Julio.pdf"))
      .toBe("Actividades-Erick-Torres-29_04-Junio_Julio.pdf");
  });

  it("quita los acentos y la ñ sin perder la extensión", () => {
    expect(rutaSegura("Nómina año 2026.pdf")).toBe("Nomina-ano-2026.pdf");
  });

  it("neutraliza los caracteres que rompen una URL", () => {
    expect(rutaSegura("informe#1?v=2.pdf")).toBe("informe-1-v-2.pdf");
  });

  it("no deja que el nombre escape de su carpeta", () => {
    expect(rutaSegura("../../etc/passwd")).not.toContain("/");
  });

  it("conserva la extensión aunque el nombre sea larguísimo", () => {
    expect(rutaSegura(`${"a".repeat(200)}.pdf`)).toMatch(/\.pdf$/);
  });

  it("da algo utilizable si no hay nombre", () => {
    expect(rutaSegura("")).toBe("archivo");
    expect(rutaSegura(null)).toBe("archivo");
  });
});

describe("mimeDeArchivo", () => {
  it("usa el tipo que da el navegador cuando lo hay", () => {
    expect(mimeDeArchivo({ name: "x.pdf", type: "application/pdf" })).toBe("application/pdf");
  });

  it("lo deduce de la extensión cuando el navegador no lo trae", () => {
    // Este es el caso real que devolvió 415: sin tipo, se mandaba octet-stream.
    expect(mimeDeArchivo({ name: "contrato.pdf", type: "" })).toBe("application/pdf");
    expect(mimeDeArchivo({ name: "recibo.XLSX", type: "" }))
      .toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(mimeDeArchivo({ name: "ine.JPG", type: "" })).toBe("image/jpeg");
  });

  it("cae a octet-stream solo cuando no hay ninguna pista", () => {
    expect(mimeDeArchivo({ name: "sin-extension", type: "" })).toBe("application/octet-stream");
    expect(mimeDeArchivo(null)).toBe("application/octet-stream");
  });

  it("los tipos que deduce son de los que el bucket acepta", () => {
    const permitidos = [
      "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];
    for (const ext of ["pdf", "doc", "docx", "xls", "xlsx", "txt", "jpg", "jpeg", "png", "webp", "heic", "heif"]) {
      expect(permitidos).toContain(mimeDeArchivo({ name: `f.${ext}`, type: "" }));
    }
  });
});

describe("formatoPeso", () => {
  it("no pinta 0 KB cuando no hay dato", () => {
    expect(formatoPeso(0)).toBe("");
    expect(formatoPeso(undefined)).toBe("");
  });

  it("redondea a KB y a MB", () => {
    expect(formatoPeso(820 * 1024)).toBe("820 KB");
    expect(formatoPeso(1.4 * 1024 * 1024)).toBe("1.4 MB");
  });
});

describe("etiquetaTipo", () => {
  it("prefiere la extensión al mime", () => {
    expect(etiquetaTipo("contrato.pdf", "application/pdf")).toBe("PDF");
  });

  it("cae al mime si no hay extensión utilizable", () => {
    expect(etiquetaTipo("sinpunto", "application/pdf")).toBe("PDF");
  });
});
