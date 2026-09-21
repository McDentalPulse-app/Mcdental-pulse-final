import { describe, it, expect } from "vitest";
import { selfieValida, FRESCURA_MS } from "./_selfie.js";

const YO = "106cff6e-ada2-4120-b233-dc8bad7c8c13";
const OTRO = "00000000-0000-4000-8000-000000000000";
const AHORA = 1_789_952_568_296;

const ruta = (empleado, marca) => `${empleado}/${marca}.jpg`;

describe("selfieValida", () => {
  it("acepta la selfie propia recién subida", () => {
    expect(selfieValida(ruta(YO, AHORA - 30_000), YO, AHORA)).toBe(true);
  });

  it("rechaza la selfie de OTRA persona", () => {
    // Sin esto, cualquiera reenvía la ruta de la selfie de un compañero.
    expect(selfieValida(ruta(OTRO, AHORA), YO, AHORA)).toBe(false);
  });

  it("rechaza una selfie vieja", () => {
    // El ataque real: reenviar una selfie propia YA APROBADA, que se ve en el propio historial,
    // para pasar el cotejo sin haber estado frente a la cámara.
    expect(selfieValida(ruta(YO, AHORA - FRESCURA_MS - 1), YO, AHORA)).toBe(false);
  });

  /**
   * EL FALLO QUE ESTE MÓDULO EXISTE PARA CERRAR.
   *
   * La comprobación anterior era `ahora - marca > FRESCURA_MS`, que solo acota el pasado. Con
   * una marca en el futuro la resta sale negativa y pasaba SIEMPRE. Se sube la foto una vez con
   * nombre futuro y esa ruta vale para siempre: el anti-replay deja de existir.
   */
  it("rechaza una marca en el FUTURO", () => {
    expect(selfieValida(ruta(YO, AHORA + 3_600_000), YO, AHORA)).toBe(false);
    expect(selfieValida(ruta(YO, AHORA + 31_536_000_000), YO, AHORA)).toBe(false);
  });

  it("acepta un desajuste pequeño del reloj del teléfono, en los dos sentidos", () => {
    // La ventana es ancha a propósito: con 60s se rechazaban checadas reales. Pero ancha en
    // ambos sentidos, no infinita hacia uno.
    expect(selfieValida(ruta(YO, AHORA + 60_000), YO, AHORA)).toBe(true);
    expect(selfieValida(ruta(YO, AHORA - 60_000), YO, AHORA)).toBe(true);
  });

  it("rechaza rutas mal formadas", () => {
    expect(selfieValida(null, YO, AHORA)).toBe(false);
    expect(selfieValida(YO, YO, AHORA)).toBe(false);              // sin barra
    expect(selfieValida(`${YO}/nada.jpg`, YO, AHORA)).toBe(false); // sin marca
    expect(selfieValida(`${YO}/../${OTRO}/1.jpg`, YO, AHORA)).toBe(false);
  });
});
