/**
 * Detección de rostro en el navegador, para el checador.
 *
 * QUÉ RESUELVE Y QUÉ NO. Esto comprueba que en la foto hay UNA cara — se acabó checar con
 * una foto del techo, del bolsillo o del cielo — y ayuda a encuadrarla. NO comprueba que
 * esa cara sea la de quien dice ser: eso es cotejo facial, corre en el servidor y es otra
 * historia (api/_rostro.js).
 *
 * Aquí, en el cliente, la comprobación es una AYUDA, no un control de seguridad: quien sepa
 * lo que hace puede llamar a la API sin pasar por esta pantalla. Su valor está en hacer que
 * el abuso perezoso —el 90% de los casos— deje de funcionar, y en recortar las fotos a la
 * cara para que el cotejo del servidor tenga algo decente con lo que trabajar.
 *
 * El modelo (225 KB) y el runtime de MediaPipe (~3 MB comprimidos) se cargan BAJO DEMANDA y
 * solo en las pantallas de cámara, no en el arranque de la app.
 */

let detectorPromesa = null;

/** Carga perezosa: una sola vez por sesión, y solo si alguien abre la cámara. */
const getDetector = () => {
  if (detectorPromesa) return detectorPromesa;

  detectorPromesa = (async () => {
    const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");

    // El wasm se sirve desde nuestro propio origen (public/mediapipe), no desde un CDN:
    // así funciona sin red externa y no hay que abrir la CSP a un tercero.
    const vision = await FilesetResolver.forVisionTasks("/mediapipe");

    return FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
    });
  })().catch((error) => {
    console.warn("No se pudo cargar el detector de rostro:", error);
    detectorPromesa = null; // que un fallo de red no deje el detector muerto para siempre
    return null;
  });

  return detectorPromesa;
};

export const RESULTADO = {
  OK: "ok",
  SIN_CARA: "sin_cara",
  VARIAS_CARAS: "varias_caras",
  NO_DISPONIBLE: "no_disponible",
};

/**
 * Busca caras en un <canvas> ya pintado.
 *
 * Devuelve { resultado, box } donde box es el recuadro de la cara en píxeles del canvas.
 *
 * Si el detector no carga (red caída, navegador viejo) devuelve NO_DISPONIBLE y el checador
 * deja pasar la checada igual. Es deliberado y es la misma regla que con el GPS: una
 * comprobación que se cae NO puede impedirle a alguien fichar su entrada.
 */
export const detectarRostro = async (canvas) => {
  const detector = await getDetector();
  if (!detector) return { resultado: RESULTADO.NO_DISPONIBLE, box: null };

  try {
    const { detections } = detector.detect(canvas);

    if (!detections?.length) return { resultado: RESULTADO.SIN_CARA, box: null };

    // Más de una cara: o alguien se coló en el encuadre, o hay dos personas delante del
    // teléfono — que es justo la situación en la que uno checa por el otro. Se rechaza en
    // vez de elegir "la más grande" y hacer como si nada.
    if (detections.length > 1) return { resultado: RESULTADO.VARIAS_CARAS, box: null };

    const bb = detections[0].boundingBox;
    return {
      resultado: RESULTADO.OK,
      box: { x: bb.originX, y: bb.originY, ancho: bb.width, alto: bb.height },
    };
  } catch (error) {
    console.warn("Falló la detección de rostro:", error);
    return { resultado: RESULTADO.NO_DISPONIBLE, box: null };
  }
};

/**
 * ¿La cara está bien encuadrada como para disparar la foto sola?
 *
 * Tres condiciones, y cada una evita una foto inservible:
 *   - CENTRADA: una cara pegada al borde suele salir cortada, y media cara no coteja.
 *   - LO BASTANTE GRANDE: si la persona está lejos, la cara tiene pocos píxeles y el
 *     modelo del servidor recibe una mancha borrosa.
 *   - NO DEMASIADO GRANDE: pegado al objetivo, la cara sale deformada por la lente y le
 *     falta la barbilla o la frente, que es donde están los rasgos que se comparan.
 */
export const encuadreBueno = (box, anchoVideo, altoVideo) => {
  if (!box || !anchoVideo || !altoVideo) return { ok: false, pista: "Colócate frente a la cámara." };

  const centroX = (box.x + box.ancho / 2) / anchoVideo;
  const centroY = (box.y + box.alto / 2) / altoVideo;
  const proporcion = box.alto / altoVideo;

  if (proporcion < 0.30) return { ok: false, pista: "Acércate un poco." };
  if (proporcion > 0.75) return { ok: false, pista: "Aléjate un poco." };
  if (Math.abs(centroX - 0.5) > 0.18 || Math.abs(centroY - 0.5) > 0.18) {
    return { ok: false, pista: "Centra tu cara en el recuadro." };
  }

  return { ok: true, pista: "¡Así! No te muevas…" };
};

/**
 * Recorta el canvas a la cara, con margen.
 *
 * El recorte NO es cosmético: es lo que hace que el cotejo del servidor compare caras contra
 * caras, en vez de una cara diminuta perdida en medio de una pared. El margen (40%) deja
 * frente y barbilla, que es donde están los rasgos que un modelo de reconocimiento usa.
 */
export const recortarACara = (canvas, box, margen = 0.4) => {
  if (!box) return canvas;

  const m = Math.max(box.ancho, box.alto) * margen;
  const x = Math.max(0, Math.round(box.x - m));
  const y = Math.max(0, Math.round(box.y - m));
  const ancho = Math.min(canvas.width - x, Math.round(box.ancho + m * 2));
  const alto = Math.min(canvas.height - y, Math.round(box.alto + m * 2));

  if (ancho <= 0 || alto <= 0) return canvas;

  const recorte = document.createElement("canvas");
  recorte.width = ancho;
  recorte.height = alto;
  recorte.getContext("2d").drawImage(canvas, x, y, ancho, alto, 0, 0, ancho, alto);
  return recorte;
};

export const MENSAJE = {
  [RESULTADO.SIN_CARA]: "No se ve tu cara. Colócate frente a la cámara e inténtalo de nuevo.",
  [RESULTADO.VARIAS_CARAS]: "Hay más de una persona en la foto. Debes salir tú solo.",
};
