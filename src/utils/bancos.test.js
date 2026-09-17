import { describe, it, expect } from "vitest";
import {
  soloDigitos,
  digitoVerificadorClabe,
  validarClabe,
  pasaLuhn,
  validarTarjeta,
  formatClabe,
  formatTarjeta,
  tieneDatosBancarios,
  BANCOS,
} from "./bancos";

// CLABE de ejemplo que circula en la documentación pública de Banxico. NO la generé yo con
// la función de abajo: es el ancla externa que impide que estas pruebas validen un
// algoritmo equivocado contra sí mismo. Si la implementación fuera mala, este caso cae.
const CLABE_PUBLICA = "032180000118359719";

// Las demás sí se construyeron con el algoritmo, y solo sirven para cubrir variedad de
// prefijos de banco una vez que el ancla de arriba demuestra que el algoritmo es el bueno.
const CLABES_VALIDAS = [
  CLABE_PUBLICA,
  "012180000123456782",
  "002180000123456789",
  "072190000555444334",
];

// Números con Luhn correcto de los juegos de prueba públicos de las marcas.
const TARJETAS_VALIDAS = ["4111111111111111", "5500000000000004", "4242424242424242"];

describe("soloDigitos", () => {
  it("quita espacios, guiones y cualquier otra cosa", () => {
    expect(soloDigitos("0321 8000 0118 3597 19")).toBe(CLABE_PUBLICA);
    expect(soloDigitos("4111-1111-1111-1111")).toBe("4111111111111111");
  });

  it("no revienta con null, undefined ni valores raros", () => {
    expect(soloDigitos(null)).toBe("");
    expect(soloDigitos(undefined)).toBe("");
    expect(soloDigitos("")).toBe("");
    expect(soloDigitos("sin dígitos")).toBe("");
  });
});

describe("digitoVerificadorClabe", () => {
  it("reproduce el dígito de una CLABE pública real", () => {
    expect(digitoVerificadorClabe(CLABE_PUBLICA.slice(0, 17))).toBe(Number(CLABE_PUBLICA[17]));
  });
});

describe("validarClabe", () => {
  it("acepta las CLABEs válidas, con y sin separadores", () => {
    for (const c of CLABES_VALIDAS) {
      expect(validarClabe(c).ok, c).toBe(true);
      expect(validarClabe(formatClabe(c)).ok, `${c} con espacios`).toBe(true);
    }
  });

  it("rechaza longitudes que no son 18 y lo dice con el conteo real", () => {
    expect(validarClabe("12345").ok).toBe(false);
    expect(validarClabe("12345").motivo).toContain("llevas 5");
    expect(validarClabe(`${CLABE_PUBLICA}9`).ok).toBe(false);
    expect(validarClabe("").ok).toBe(false);
  });

  it("rechaza letras (quedan fuera al dejar solo dígitos, y entonces falta longitud)", () => {
    expect(validarClabe("03218000011835971X").ok).toBe(false);
  });

  it("caza SIEMPRE un solo dígito equivocado: las 162 variantes de una CLABE real", () => {
    let cazadas = 0;
    let probadas = 0;
    for (let i = 0; i < 18; i += 1) {
      for (let d = 0; d <= 9; d += 1) {
        if (Number(CLABE_PUBLICA[i]) === d) continue;
        probadas += 1;
        const rota = CLABE_PUBLICA.slice(0, i) + d + CLABE_PUBLICA.slice(i + 1);
        if (!validarClabe(rota).ok) cazadas += 1;
      }
    }
    expect(probadas).toBe(162);
    expect(cazadas).toBe(162);
  });

  // La cifra honesta: 12 de 13, NO todas. Se fija aquí para que nadie escriba luego en un
  // comentario que el dígito verificador caza cualquier transposición — no la caza, y si
  // alguien "arregla" el algoritmo y esta cuenta cambia, más vale enterarse.
  //
  // El bucle llega hasta i = 16 para incluir el par (16, 17), que es el que intercambia el
  // último dígito de la cuenta con el DÍGITO DE CONTROL. Una primera versión paraba en 15 y
  // se dejaba fuera justo ese caso, que es de los más fáciles de cometer al teclear: daba
  // "11 de 12" y sonaba a medición completa sin serlo.
  it("caza 12 de las 13 transposiciones contiguas: es buena red, no garantía", () => {
    let cazadas = 0;
    let probadas = 0;
    const escapan = [];
    for (let i = 0; i < 17; i += 1) {
      if (CLABE_PUBLICA[i] === CLABE_PUBLICA[i + 1]) continue; // intercambiar iguales no cambia nada
      probadas += 1;
      const rota =
        CLABE_PUBLICA.slice(0, i) + CLABE_PUBLICA[i + 1] + CLABE_PUBLICA[i] + CLABE_PUBLICA.slice(i + 2);
      if (!validarClabe(rota).ok) cazadas += 1;
      else escapan.push(i);
    }
    expect(probadas).toBe(13);
    expect(cazadas).toBe(12);
    // Se fija CUÁL escapa, no solo cuántas: los pesos 3,7,1 dejan pasar un intercambio cuando
    // los dos productos coinciden módulo 10, y aquí ocurre en el par (11,12) = "83".
    expect(escapan).toEqual([11]);
  });
});

describe("pasaLuhn / validarTarjeta", () => {
  it("acepta las tarjetas con Luhn correcto, con y sin separadores", () => {
    for (const t of TARJETAS_VALIDAS) {
      expect(pasaLuhn(t), t).toBe(true);
      expect(validarTarjeta(t).ok, t).toBe(true);
      expect(validarTarjeta(formatTarjeta(t)).ok, `${t} con espacios`).toBe(true);
    }
  });

  it("rechaza un número con el último dígito cambiado", () => {
    expect(validarTarjeta("4111111111111112").ok).toBe(false);
  });

  it("rechaza longitudes que no son 16", () => {
    expect(validarTarjeta("411111111111111").ok).toBe(false);
    expect(validarTarjeta("41111111111111111").ok).toBe(false);
    expect(validarTarjeta("").ok).toBe(false);
  });

  it("caza cualquier dígito suelto equivocado en una tarjeta real", () => {
    const base = TARJETAS_VALIDAS[2];
    for (let i = 0; i < 16; i += 1) {
      for (let d = 0; d <= 9; d += 1) {
        if (Number(base[i]) === d) continue;
        const rota = base.slice(0, i) + d + base.slice(i + 1);
        expect(validarTarjeta(rota).ok, rota).toBe(false);
      }
    }
  });
});

describe("formato de lectura", () => {
  it("agrupa la CLABE 3-3-11-1, como la imprime el estado de cuenta", () => {
    expect(formatClabe(CLABE_PUBLICA)).toBe("032 180 00011835971 9");
  });

  it("agrupa la tarjeta de cuatro en cuatro, sin espacio al final", () => {
    expect(formatTarjeta("4111111111111111")).toBe("4111 1111 1111 1111");
  });

  it("devuelve lo que haya si todavía no está completo, para no estorbar mientras se teclea", () => {
    expect(formatClabe("0321")).toBe("0321");
    expect(formatTarjeta("41")).toBe("41");
  });
});

describe("tieneDatosBancarios", () => {
  it("basta con que uno de los tres esté puesto", () => {
    expect(tieneDatosBancarios({ banco: "BBVA" })).toBe(true);
    expect(tieneDatosBancarios({ clabe: CLABE_PUBLICA })).toBe(true);
    expect(tieneDatosBancarios({ tarjeta: "4111111111111111" })).toBe(true);
  });

  it("es false si no hay nada, y no revienta sin usuario", () => {
    expect(tieneDatosBancarios({ banco: null, clabe: null, tarjeta: null })).toBe(false);
    expect(tieneDatosBancarios({})).toBe(false);
    expect(tieneDatosBancarios(null)).toBe(false);
    expect(tieneDatosBancarios(undefined)).toBe(false);
  });
});

describe("catálogo de bancos", () => {
  it("no tiene repetidos y deja salida por «Otro»", () => {
    expect(new Set(BANCOS).size).toBe(BANCOS.length);
    expect(BANCOS).toContain("Otro");
  });

  it("cabe en el límite de 60 caracteres del CHECK de la migración 163", () => {
    for (const b of BANCOS) expect(b.length).toBeLessThanOrEqual(60);
  });
});
