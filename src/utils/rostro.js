/**
 * Detección de rostro en el navegador, para el checador.
 *
 * QUÉ RESUELVE Y QUÉ NO. Esto comprueba que en la foto hay UNA cara — se acabó checar
 * con una foto del techo, del bolsillo o del cielo. NO comprueba que esa cara sea la de
 * quien dice ser: eso es cotejo facial, corre en el servidor y es otra historia.
 *
 * Aquí, en el cliente, la comprobación es una AYUDA, no un control de seguridad: quien
 * sepa lo que hace puede llamar a la API sin pasar por esta pantalla. Su valor está en
 * hacer que el abuso perezoso —el 90% de los casos— deje de funcionar, y en recortar
 * las fotos a la cara para que el cotejo del servidor tenga algo decente con lo que
 * trabajar.
 *
 * El modelo (225 KB) y el runtime de MediaPipe (~3 MB comprimidos) se cargan BAJO
 * DEMANDA y solo en el checador, no en el arranque de la app. Es un coste real la
 * primera vez que alguien abre la pantalla; después queda en la caché del navegador.
 */

let detectorPromesa = null;

/** Carga perezosa: una sola vez por sesión, y solo si alguien abre el checador. */
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
 * Si el detector no carga (red caída, navegador viejo) devuelve NO_DISPONIBLE y el
 * checador deja pasar la checada igual. Es deliberado y es la misma regla que con el
 * GPS: una comprobación que se cae NO puede impedirle a alguien fichar su entrada. Se
 * registra, se marca, y RH lo ve.
 */
export const detectarRostro = async (canvas) => {
  const detector = await getDetector();
  if (!detector) return { resultado: RESULTADO.NO_DISPONIBLE, box: null };

  try {
    const { detections } = detector.detect(canvas);

    if (!detections?.length) return { resultado: RESULTADO.SIN_CARA, box: null };

    // Más de una cara: o alguien se coló en el encuadre, o hay dos personas delante del
    // teléfono — que es justo la situación en la que uno checa por el otro. Se rechaza
    // en vez de elegir "la más grande" y hacer como si nada.
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
 * Recorta el canvas a la cara, con margen.
 *
 * El recorte NO es cosmético: es lo que hará que el cotejo facial del servidor compare
 * caras contra caras, en vez de una cara contra una cara diminuta perdida en medio de
 * una pared. El margen (40%) deja frente y barbilla, que es donde están los rasgos que
 * un modelo de reconocimiento usa.
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
