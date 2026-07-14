import path from "node:path";
import ort from "onnxruntime-node";
import sharp from "sharp";

/**
 * Reconocimiento facial. Corre EN EL SERVIDOR, y eso no es un detalle de implementación:
 * es la única razón por la que sirve de algo.
 *
 * Si el navegador calculara el parecido y mandara el resultado, cualquiera podría enviar
 * un 99% desde la consola. Por eso el cliente solo sube una FOTO; el servidor la baja del
 * bucket privado, detecta la cara, la alinea, calcula su huella y la compara contra la
 * huella enrolada. El cliente no ve ni toca ninguna de las dos huellas.
 *
 * MODELOS (los dos de OpenCV Zoo, Apache-2.0 — comercialmente usables):
 *   - YuNet (228 KB): detecta la cara y devuelve 5 puntos (ojos, nariz, comisuras).
 *   - SFace (37 MB): convierte una cara alineada de 112x112 en 128 números.
 *
 * La licencia fue el criterio de selección, no la precisión: casi todos los modelos
 * punteros de este campo (InsightFace y sus derivados) son SOLO PARA INVESTIGACIÓN y no
 * se pueden usar en una empresa. Ver api/models/LICENSE-sface.txt.
 *
 * POR QUÉ HAY QUE ALINEAR, y no basta con recortar:
 * La primera versión de esto metía la foto entera al modelo. Medido con retratos reales,
 * el resultado salió INVERTIDO — la misma persona en dos fotos daba 0.198 de parecido, y
 * dos personas distintas 0.44. El modelo estaba comparando fondos, pelo y ropa. SFace
 * espera la cara recortada Y rotada hasta que los ojos caen en unas coordenadas concretas;
 * sin ese paso no reconoce a nadie, y lo peor es que no falla: devuelve números con toda
 * la pinta de ser válidos.
 */

const DIR = path.join(process.cwd(), "api", "models");
const LADO = 112;      // lo que espera SFace
const LADO_DET = 640;  // tamaño de entrada FIJO de este YuNet: no acepta otro

/**
 * Umbral de coseno por encima del cual se considera la misma persona.
 *
 * 0.363 es el valor que publica OpenCV para SFace. NO está ajustado con la plantilla real,
 * y ajustarlo es parte de poner esto en producción: con las primeras semanas de datos se
 * verá dónde caen de verdad los aciertos y los fallos.
 *
 * Recuerda que esto NO bloquea a nadie: un umbral mal puesto genera ruido en el panel de
 * RH, no empleados que no pueden fichar.
 */
export const UMBRAL_MISMA_PERSONA = 0.363;

/**
 * Dónde deben acabar los 5 puntos de la cara en la imagen de 112x112. Es la plantilla
 * canónica de ArcFace, la misma que usa OpenCV, y el orden importa: ojo derecho de la
 * persona (izquierda de la imagen), ojo izquierdo, nariz, comisura derecha, comisura
 * izquierda — exactamente el orden en que los devuelve YuNet.
 */
const PLANTILLA = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

const sesiones = {};
const getSesion = (nombre) => {
  if (!sesiones[nombre]) {
    sesiones[nombre] = ort.InferenceSession
      .create(path.join(DIR, `${nombre}.onnx`))
      .catch((error) => {
        delete sesiones[nombre]; // que un fallo puntual no deje la función muerta
        throw error;
      });
  }
  return sesiones[nombre];
};

/** Imagen a tensor BGR/CHW en 0-255, que es lo que esperan los dos modelos. */
const aTensorBGR = (rgb, ancho, alto) => {
  const pixeles = ancho * alto;
  const t = new Float32Array(3 * pixeles);
  for (let i = 0; i < pixeles; i += 1) {
    t[i] = rgb[i * 3 + 2];              // B
    t[pixeles + i] = rgb[i * 3 + 1];    // G
    t[pixeles * 2 + i] = rgb[i * 3];    // R
  }
  return new ort.Tensor("float32", t, [1, 3, alto, ancho]);
};

/**
 * Detecta la cara más grande y devuelve sus 5 puntos, en coordenadas de la imagen original.
 *
 * YuNet no devuelve cajas: devuelve, para cada casilla de tres rejillas (de 8, 16 y 32
 * píxeles de paso), cuánto se desvía una cara respecto a esa casilla. Hay que "decodificar"
 * esas desviaciones contra la rejilla para recuperar las coordenadas reales.
 */
const detectarCara = async (rgb, ancho, alto) => {
  const sesion = await getSesion("yunet");
  const entrada = aTensorBGR(rgb, ancho, alto);
  const salida = await sesion.run({ [sesion.inputNames[0]]: entrada });

  let mejor = null;

  for (const paso of [8, 16, 32]) {
    const cls = salida[`cls_${paso}`].data;
    const obj = salida[`obj_${paso}`].data;
    const bbox = salida[`bbox_${paso}`].data;
    const kps = salida[`kps_${paso}`].data;

    const columnas = Math.ceil(ancho / paso);
    const filas = Math.ceil(alto / paso);

    for (let f = 0; f < filas; f += 1) {
      for (let c = 0; c < columnas; c += 1) {
        const i = f * columnas + c;

        // El score combina "aquí hay algo" (obj) y "eso que hay es una cara" (cls). La
        // media geométrica es la que usa OpenCV: penaliza que cualquiera de los dos sea bajo.
        const score = Math.sqrt(Math.max(0, cls[i]) * Math.max(0, obj[i]));
        if (score < 0.6) continue;

        const w = Math.exp(bbox[i * 4 + 2]) * paso;
        const h = Math.exp(bbox[i * 4 + 3]) * paso;
        const area = w * h;

        // La cara más grande es la del que está checando. Si hay otra al fondo, es un
        // transeúnte — y si hay dos caras grandes, el cliente ya lo rechazó antes de subirla.
        if (mejor && area <= mejor.area) continue;

        const puntos = [];
        for (let p = 0; p < 5; p += 1) {
          puntos.push([
            (c + kps[i * 10 + p * 2]) * paso,
            (f + kps[i * 10 + p * 2 + 1]) * paso,
          ]);
        }

        mejor = { score, area, puntos };
      }
    }
  }

  return mejor;
};

/**
 * Transformación de semejanza (rotación + escala uniforme + traslación) que lleva los
 * puntos detectados a la plantilla canónica.
 *
 * Es un ajuste por mínimos cuadrados sobre 4 incógnitas: la matriz [[a,-b],[b,a]] es
 * exactamente una rotación combinada con un escalado, así que resolverla en esa forma
 * garantiza que la cara no se deforme — solo gire, se acerque y se centre. Un ajuste afín
 * general (6 incógnitas) sí la deformaría, y una cara estirada deja de parecerse a sí misma.
 */
const transformacion = (origen, destino) => {
  const n = origen.length;
  const media = (ps, k) => ps.reduce((s, p) => s + p[k], 0) / n;

  const mox = media(origen, 0);
  const moy = media(origen, 1);
  const mdx = media(destino, 0);
  const mdy = media(destino, 1);

  let num_a = 0;
  let num_b = 0;
  let den = 0;

  for (let i = 0; i < n; i += 1) {
    const ox = origen[i][0] - mox;
    const oy = origen[i][1] - moy;
    const dx = destino[i][0] - mdx;
    const dy = destino[i][1] - mdy;

    num_a += ox * dx + oy * dy;
    num_b += ox * dy - oy * dx;
    den += ox * ox + oy * oy;
  }

  if (den === 0) return null;

  const a = num_a / den;
  const b = num_b / den;

  return {
    a,
    b,
    tx: mdx - (a * mox - b * moy),
    ty: mdy - (b * mox + a * moy),
  };
};

/** Recorta y endereza la cara a 112x112, muestreando con interpolación bilineal. */
const alinear = (rgb, ancho, alto, puntos) => {
  const t = transformacion(puntos, PLANTILLA);
  if (!t) return null;

  // Se recorre la imagen de SALIDA y se pregunta de qué píxel de la ENTRADA viene cada uno
  // (mapeo inverso). Al revés quedarían huecos sin pintar.
  const det = t.a * t.a + t.b * t.b;
  if (det === 0) return null;

  const salida = new Uint8Array(LADO * LADO * 3);

  for (let v = 0; v < LADO; v += 1) {
    for (let u = 0; u < LADO; u += 1) {
      const dx = u - t.tx;
      const dy = v - t.ty;
      const x = (t.a * dx + t.b * dy) / det;
      const y = (-t.b * dx + t.a * dy) / det;

      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;

      for (let ch = 0; ch < 3; ch += 1) {
        const px = (cx, cy) => {
          const sx = Math.min(ancho - 1, Math.max(0, cx));
          const sy = Math.min(alto - 1, Math.max(0, cy));
          return rgb[(sy * ancho + sx) * 3 + ch];
        };

        const valor =
          px(x0, y0) * (1 - fx) * (1 - fy) +
          px(x0 + 1, y0) * fx * (1 - fy) +
          px(x0, y0 + 1) * (1 - fx) * fy +
          px(x0 + 1, y0 + 1) * fx * fy;

        salida[(v * LADO + u) * 3 + ch] = valor;
      }
    }
  }

  return salida;
};

/**
 * Huella facial de una imagen: 128 números, o null si no se ve ninguna cara.
 *
 * null NO es un error: es "no se pudo comprobar". El checador no bloquea por eso — se
 * registra la checada y RH la ve marcada como no verificada.
 */
export const calcularHuella = async (bufferImagen) => {
  const original = await sharp(bufferImagen).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: ancho, height: alto } = original.info;

  // Para detectar basta con una versión pequeña. Se mantiene la proporción y se pega
  // arriba a la izquierda: así, para volver a las coordenadas originales, solo hay que
  // dividir por la escala — sin restar ningún margen que sería fácil equivocar.
  const escala = Math.min(LADO_DET / ancho, LADO_DET / alto);
  const chico = await sharp(bufferImagen)
    .resize(LADO_DET, LADO_DET, { fit: "contain", position: "left top", background: { r: 0, g: 0, b: 0 } })
    .removeAlpha()
    .raw()
    .toBuffer();

  const cara = await detectarCara(chico, LADO_DET, LADO_DET);
  if (!cara) return null;

  const puntos = cara.puntos.map(([x, y]) => [x / escala, y / escala]);
  const alineada = alinear(original.data, ancho, alto, puntos);
  if (!alineada) return null;

  const sesion = await getSesion("sface");
  const salida = await sesion.run({ [sesion.inputNames[0]]: aTensorBGR(alineada, LADO, LADO) });

  return Array.from(salida[sesion.outputNames[0]].data);
};

/**
 * Parecido entre dos huellas: -1 (opuestas) a 1 (idénticas).
 * Coseno, porque es en lo que está expresado el umbral publicado para SFace.
 */
export const similitud = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) return null;

  let punto = 0;
  let normaA = 0;
  let normaB = 0;

  for (let i = 0; i < a.length; i += 1) {
    punto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }

  if (normaA === 0 || normaB === 0) return null;
  return punto / (Math.sqrt(normaA) * Math.sqrt(normaB));
};
