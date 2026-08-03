import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { recortarConMargen } from "./_rostro.js";

/**
 * La geometría del recorte del anti-spoofing.
 *
 * Estas pruebas existen por un fallo que estuvo vivo desde que nació el anti-spoofing y no se
 * vio nunca: `sharp` aplica `.extract()` ANTES que `.extend()` si van encadenados, así que el
 * recorte se calculaba contra la imagen SIN acolchar y se salía siempre. Resultado: excepción
 * en el 100% de las checadas, `liveness_score` en NULL, y cero datos para calibrar — todo en
 * silencio, porque quien llama se traga el error a propósito para no impedir ninguna checada.
 *
 * Lo que se prueba es justo lo que fallaba: que el recorte SALGA, con la cara donde sea. No se
 * cargan los modelos ONNX (pesan 38 MB y aquí no aportan): la geometría es lo que se rompió.
 */

const LADO_VIVEZA = 128;
const BYTES_ESPERADOS = LADO_VIVEZA * LADO_VIVEZA * 3; // RGB crudo

const imagen = (ancho, alto) =>
  sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 90, b: 80 } } })
    .jpeg()
    .toBuffer();

describe("recortarConMargen", () => {
  it("recorta una cara centrada en una selfie vertical típica", async () => {
    const buf = await imagen(480, 640);
    const recorte = await recortarConMargen(buf, [140, 180, 200, 240]);
    expect(recorte).not.toBeNull();
    expect(recorte.length).toBe(BYTES_ESPERADOS);
  });

  it("recorta aunque la cara toque el borde izquierdo (el margen se sale de la imagen)", async () => {
    const buf = await imagen(480, 640);
    const recorte = await recortarConMargen(buf, [0, 200, 180, 200]);
    expect(recorte.length).toBe(BYTES_ESPERADOS);
  });

  it("recorta aunque la cara toque el borde derecho", async () => {
    const buf = await imagen(480, 640);
    const recorte = await recortarConMargen(buf, [300, 200, 180, 200]);
    expect(recorte.length).toBe(BYTES_ESPERADOS);
  });

  it("recorta aunque la cara se salga por arriba (alguien muy pegado al móvil)", async () => {
    const buf = await imagen(480, 640);
    const recorte = await recortarConMargen(buf, [140, -40, 200, 240]);
    expect(recorte.length).toBe(BYTES_ESPERADOS);
  });

  it("recorta cuando la cara es MÁS GRANDE que la imagen una vez ensanchada 1.5x", async () => {
    // El caso real: alguien se pega al teléfono y su cara llena el encuadre. El cuadrado
    // ensanchado es entonces mayor que la foto entera, que es donde el `.extract()` encadenado
    // desbordaba sin remedio.
    const buf = await imagen(480, 640);
    const recorte = await recortarConMargen(buf, [20, 40, 440, 560]);
    expect(recorte.length).toBe(BYTES_ESPERADOS);
  });

  it("recorta en horizontal (tableta o móvil de lado)", async () => {
    const buf = await imagen(640, 480);
    const recorte = await recortarConMargen(buf, [240, 120, 200, 240]);
    expect(recorte.length).toBe(BYTES_ESPERADOS);
  });

  it("devuelve null si la cara es demasiado pequeña para medir nada", async () => {
    const buf = await imagen(480, 640);
    expect(await recortarConMargen(buf, [10, 10, 6, 8])).toBeNull();
  });

  it("devuelve null con una caja inservible en vez de reventar", async () => {
    const buf = await imagen(480, 640);
    expect(await recortarConMargen(buf, [NaN, NaN, NaN, NaN])).toBeNull();
  });
});
