import { describe, it, expect } from "vitest";
import { evaluarUbicacion, evaluarUbicacionEnVarias } from "./geo";

// Sucursal de referencia: radio chico (15 m) para que el margen de precisión importe.
const SUC = { lat: 25.6866, lng: -100.3161, radioM: 15 };

// ~30 m al norte (0.00027° lat ≈ 30 m). ~60 m al norte para "fuera claro".
const P30 = { lat: 25.68687, lng: -100.3161 };
const P60 = { lat: 25.68714, lng: -100.3161 };

describe("evaluarUbicacion — regla compartida con el servidor", () => {
  it("sin coordenadas => sin_gps (bloquea)", () => {
    expect(evaluarUbicacion(null, SUC).estado).toBe("sin_gps");
    expect(evaluarUbicacion({ lat: null, lng: null, precision: 10 }, SUC).estado).toBe("sin_gps");
  });

  it("sucursal sin geocerca => sin_geocerca (pasa)", () => {
    const r = evaluarUbicacion({ lat: 25.6866, lng: -100.3161, precision: 5 }, { lat: null, lng: null, radioM: 15 });
    expect(r.estado).toBe("sin_geocerca");
  });

  it("dentro del radio con buena precisión => dentro", () => {
    const r = evaluarUbicacion({ ...SUC, precision: 5 }, SUC);
    expect(r.estado).toBe("dentro");
    expect(r.distanciaM).toBe(0);
  });

  it("lejos y con GPS preciso => fuera", () => {
    const r = evaluarUbicacion({ ...P60, precision: 5 }, SUC);
    expect(r.estado).toBe("fuera");
    expect(r.distanciaM).toBeGreaterThan(SUC.radioM);
  });

  it("cerca pero con GPS impreciso => dentro (se le da el beneficio de su incertidumbre)", () => {
    // 30 m de distancia, ±60 m de precisión: 30 - 60 <= 15 => dentro.
    const r = evaluarUbicacion({ ...P30, precision: 60 }, SUC);
    expect(r.estado).toBe("dentro");
  });

  it("precisión monstruosa se topea en 100 m (no vuelve la geocerca infinita)", () => {
    // Muy lejos (~300 m) con precisión 5000: el tope de 100 m no alcanza a rescatarlo => fuera.
    const lejos = { lat: 25.6893, lng: -100.3161, precision: 5000 };
    expect(evaluarUbicacion(lejos, SUC).estado).toBe("fuera");
  });
});

// Quien apoya en otras clínicas (permiso `puede_marcar_en_cualquier_clinica`, migración 118).
// Estas pruebas son el gemelo de la SQL `sucursal_para_checada`: si una cambia, la otra también.
describe("evaluarUbicacionEnVarias — el permiso de marcar en cualquier clínica", () => {
  const OTRA = { lat: 25.7, lng: -100.35, radioM: 15 };       // ~4 km de SUC
  const LEJOS = { lat: 19.4326, lng: -99.1332, radioM: 15 };  // CDMX, cientos de km

  it("dentro de UNA de ellas => dentro (aunque no sea la primera de la lista)", () => {
    const r = evaluarUbicacionEnVarias({ ...OTRA, precision: 5 }, [SUC, LEJOS, OTRA]);
    expect(r.estado).toBe("dentro");
    expect(r.distanciaM).toBe(0);
  });

  it("fuera de todas => fuera, con la distancia a la MÁS CERCANA", () => {
    const enMedioDeLaNada = { lat: 25.75, lng: -100.4, precision: 5 };
    const r = evaluarUbicacionEnVarias(enMedioDeLaNada, [LEJOS, SUC, OTRA]);
    expect(r.estado).toBe("fuera");
    // La más cercana es OTRA; la distancia tiene que ser esa y no la de CDMX.
    expect(r.distanciaM).toBe(evaluarUbicacion(enMedioDeLaNada, OTRA).distanciaM);
  });

  it("sin GPS => sin_gps (bloquea igual: el permiso no exime de dar ubicación)", () => {
    expect(evaluarUbicacionEnVarias(null, [SUC, OTRA]).estado).toBe("sin_gps");
  });

  it("lista vacía => sin_geocerca (no bloquea; es un problema de configuración)", () => {
    expect(evaluarUbicacionEnVarias({ ...SUC, precision: 5 }, []).estado).toBe("sin_geocerca");
  });

  it("ninguna clínica con coordenadas => sin_geocerca (no bloquea)", () => {
    const sinGeocerca = [{ lat: null, lng: null, radioM: 15 }, { lat: null, lng: null, radioM: 15 }];
    expect(evaluarUbicacionEnVarias({ ...SUC, precision: 5 }, sinGeocerca).estado).toBe("sin_geocerca");
  });
});
