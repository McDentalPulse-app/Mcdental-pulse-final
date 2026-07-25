import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  UMBRAL_ACTUAL,
  margenPorEmpleado,
  masCercaDeColarse,
  costeDeSubir,
  curvaDeCoste,
  intentosPorEmpleado,
  histograma,
  parecidosPeligrosos,
} from "./calibracion";

describe("UMBRAL_ACTUAL", () => {
  it("es EXACTAMENTE el que aplica el servidor", () => {
    // Este número está duplicado (el navegador no puede importar de api/). Si alguien sube el
    // umbral del servidor y se olvida de este, la pantalla de calibración seguiría dibujando la
    // raya en el sitio viejo — y esa es la peor forma de mentir que hay: una que parece una
    // medición. Así que se lee del archivo de verdad y se compara.
    const fuente = readFileSync(new URL("../../api/_rostro.js", import.meta.url), "utf8");
    const encontrado = fuente.match(/UMBRAL_MISMA_PERSONA\s*=\s*([\d.]+)/);
    expect(encontrado, "no se encontró UMBRAL_MISMA_PERSONA en api/_rostro.js").not.toBeNull();
    expect(Number(encontrado[1])).toBe(UMBRAL_ACTUAL);
  });
});

describe("margenPorEmpleado", () => {
  const checadas = [
    { empleado_id: "a", match_score: 0.9 },
    { empleado_id: "a", match_score: 0.85 },
    { empleado_id: "b", match_score: 0.52 }, // este pasa RASPANDO
    { empleado_id: "b", match_score: 0.88 },
  ];

  it("manda el MÍNIMO, no el promedio", () => {
    // El promedio de "b" es 0.70: se ve perfectamente sano y no avisa de nada. Su mínimo es
    // 0.52, o sea que un día estuvo a 0.02 de no poder entrar a trabajar. El promedio esconde
    // exactamente lo que hay que ver.
    const [peor] = margenPorEmpleado(checadas);
    expect(peor.empleadoId).toBe("b");
    expect(peor.minimo).toBe(0.52);
    expect(peor.media).toBeCloseTo(0.7);
    expect(peor.justo).toBe(true);
  });

  it("el que va sobrado no sale marcado", () => {
    const sobrado = margenPorEmpleado(checadas).find((e) => e.empleadoId === "a");
    expect(sobrado.justo).toBe(false);
    expect(sobrado.margen).toBeCloseTo(0.35);
  });

  it("ordena por quien peor lo tiene", () => {
    expect(margenPorEmpleado(checadas).map((e) => e.empleadoId)).toEqual(["b", "a"]);
  });

  it("las checadas sin cotejo (altas manuales de RH) no cuentan", () => {
    // Un alta manual no tiene score. Contarla como 0 pondría a esa persona la primera de la
    // lista de "a punto de no poder fichar", que es justo la alarma que no debe dar ruido.
    const con = margenPorEmpleado([...checadas, { empleado_id: "c", match_score: null }]);
    expect(con.map((e) => e.empleadoId)).not.toContain("c");
  });
});

describe("masCercaDeColarse", () => {
  it("devuelve el rechazo que más cerca estuvo, y cuánto le faltó", () => {
    const r = masCercaDeColarse([
      { empleado_id: "a", score: 0.12, creado_en: "2026-07-01" },
      { empleado_id: "b", score: 0.47, creado_en: "2026-07-02" }, // este da miedo
      { empleado_id: "c", score: 0.3, creado_en: "2026-07-03" },
    ]);
    expect(r.score).toBe(0.47);
    expect(r.empleadoId).toBe("b");
    expect(r.distancia).toBeCloseTo(0.03); // a 0.03 de colarse
  });

  it("sin intentos, no se inventa un número", () => {
    expect(masCercaDeColarse([])).toBeNull();
  });
});

describe("costeDeSubir", () => {
  const checadas = [
    { empleado_id: "a", match_score: 0.9 },
    { empleado_id: "b", match_score: 0.55 },
    { empleado_id: "b", match_score: 0.58 },
    { empleado_id: "c", match_score: 0.59 },
  ];

  it("dice cuántas checadas REALES se habrían caído, y de cuánta gente", () => {
    // Subir a 0.60 suena inofensivo hasta que se ve que deja fuera 3 checadas de 2 personas de
    // verdad — que es lo que significa "no pudieron fichar".
    const coste = costeDeSubir(checadas, 0.6);
    expect(coste.checadasRechazadas).toBe(3);
    expect(coste.empleadosAfectados).toBe(2);
    expect(coste.porcentaje).toBe(75);
  });

  it("con el umbral actual, el coste es cero (por construcción: todas pasaron)", () => {
    expect(costeDeSubir(checadas, UMBRAL_ACTUAL).checadasRechazadas).toBe(0);
  });
});

describe("curvaDeCoste", () => {
  it("recorre los umbrales candidatos con etiquetas limpias", () => {
    // 0.5 + 0.05 + 0.05 en coma flotante da 0.6000000000000001. En un eje de un gráfico eso se
    // lee fatal.
    const curva = curvaDeCoste([{ empleado_id: "a", match_score: 0.9 }], 0.5, 0.7, 0.05);
    expect(curva.map((p) => p.umbral)).toEqual([0.5, 0.55, 0.6, 0.65, 0.7]);
  });
});

describe("intentosPorEmpleado", () => {
  it("ordena por quién acumula más fallos", () => {
    const r = intentosPorEmpleado([
      { empleado_id: "a", score: 0.1 },
      { empleado_id: "b", score: 0.3 },
      { empleado_id: "b", score: 0.44 },
      { empleado_id: "b", score: 0.2 },
    ]);
    expect(r[0]).toMatchObject({ empleadoId: "b", n: 3, maximo: 0.44 });
  });
});

describe("histograma", () => {
  it("el valor máximo exacto cae dentro, no fuera", () => {
    // Sin el tope del último cubo, un 1.0 exacto se saldría del array y desaparecería del
    // gráfico sin que nadie lo notara.
    const barras = histograma([1.0], { desde: 0, hasta: 1, cubos: 10 });
    expect(barras[9].n).toBe(1);
  });

  it("reparte los valores en sus cubos", () => {
    const barras = histograma([0.05, 0.15, 0.16], { desde: 0, hasta: 1, cubos: 10 });
    expect(barras[0].n).toBe(1);
    expect(barras[1].n).toBe(2);
  });
});

describe("parecidosPeligrosos", () => {
  it("saca a los que se parecen demasiado a otro, el peor primero", () => {
    const r = parecidosPeligrosos([
      { empleado_id: "a", parecido_maximo: 0.2 },
      { empleado_id: "b", parecido_maximo: 0.45 },
      { empleado_id: "c", parecido_maximo: 0.41 },
      { empleado_id: "d", parecido_maximo: null }, // aún no medido
    ]);
    expect(r.map((x) => x.empleado_id)).toEqual(["b", "c"]);
  });
});
