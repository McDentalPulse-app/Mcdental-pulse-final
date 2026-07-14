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
  POSE_INCORRECTA: "pose_incorrecta",
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
      // 6 puntos, en este orden: ojo derecho, ojo izquierdo, nariz, centro de la boca,
      // oreja derecha, oreja izquierda. "Derecho" es el de LA PERSONA, así que en la imagen
      // aparece a la izquierda. Con los tres primeros basta para saber hacia dónde mira.
      puntos: detections[0].keypoints || null,
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

export const POSE = {
  FRONTAL: "frontal",
  DERECHA: "derecha",   // la persona gira la cabeza hacia SU derecha
  IZQUIERDA: "izquierda",
};

/**
 * Hacia dónde mira la cabeza, a partir de la posición de la nariz entre los dos ojos.
 *
 * Devuelve `t`: dónde cae la nariz sobre la línea que une los ojos. 0 = pegada al ojo
 * derecho, 1 = pegada al izquierdo, 0.5 = justo en medio (cara de frente). Al girar la
 * cabeza, la nariz se desplaza hacia el ojo del lado hacia el que se gira.
 *
 * Se proyecta sobre la línea de los ojos en vez de mirar solo la coordenada X: así, si la
 * persona INCLINA la cabeza (que es lo que todo el mundo hace al mirarse en el móvil), el
 * cálculo no se estropea. Con la X a secas, una cabeza ladeada parecería estar de perfil.
 */
export const estimarPose = (puntos) => {
  if (!puntos || puntos.length < 3) return null;

  const [ojoDerecho, ojoIzquierdo, nariz] = puntos;

  const ex = ojoIzquierdo.x - ojoDerecho.x;
  const ey = ojoIzquierdo.y - ojoDerecho.y;
  const largo2 = ex * ex + ey * ey;
  if (!largo2) return null;

  const t = ((nariz.x - ojoDerecho.x) * ex + (nariz.y - ojoDerecho.y) * ey) / largo2;

  // La imagen que se analiza NO está espejada (el espejo es solo del CSS, para que la
  // persona se vea como en un espejo). Así que el ojo derecho de la persona cae a la
  // izquierda de la imagen, y girar la cabeza hacia SU derecha mueve la nariz hacia allí:
  // t baja.
  let pose = null;
  if (Math.abs(t - 0.5) <= 0.10) pose = POSE.FRONTAL;
  else if (t <= 0.34) pose = POSE.DERECHA;
  else if (t >= 0.66) pose = POSE.IZQUIERDA;

  return { pose, t };
};

/**
 * ¿La cabeza está en la pose que se le pide? Devuelve también qué decirle si no.
 *
 * Sin esto, las tres fotos del registro salen idénticas: la persona se queda quieta, la
 * cámara dispara tres veces seguidas y guarda la misma cara tres veces. Tener tres fotos
 * solo sirve si son ángulos distintos — es lo que hace que el cotejo siga funcionando
 * cuando alguien checa con la cabeza un poco girada.
 */
export const poseCoincide = (puntos, requerida) => {
  if (!requerida) return { ok: true, pista: null };

  const estimada = estimarPose(puntos);
  if (!estimada) return { ok: true, pista: null }; // sin puntos no se puede exigir nada

  const { pose, t } = estimada;
  if (pose === requerida) return { ok: true, pista: null };

  if (requerida === POSE.FRONTAL) {
    return { ok: false, pista: "Mira de frente a la cámara." };
  }

  // Se distingue "aún no has girado" de "te has pasado y giraste al otro lado": decirle
  // "gira a la derecha" a alguien que YA está girado a la izquierda es sacarlo de quicio.
  const haciaLaRequerida = requerida === POSE.DERECHA ? t > 0.34 : t < 0.66;
  const alReves = requerida === POSE.DERECHA ? t > 0.66 : t < 0.34;

  if (alReves) {
    return {
      ok: false,
      pista: requerida === POSE.DERECHA
        ? "Ese es el otro lado. Gira hacia tu derecha."
        : "Ese es el otro lado. Gira hacia tu izquierda.",
    };
  }

  if (haciaLaRequerida) {
    return {
      ok: false,
      pista: requerida === POSE.DERECHA
        ? "Gira un poco más la cabeza hacia tu derecha."
        : "Gira un poco más la cabeza hacia tu izquierda.",
    };
  }

  return { ok: false, pista: "Gira un poco la cabeza." };
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
  [RESULTADO.POSE_INCORRECTA]: "Gira la cabeza como se te indica antes de tomar la foto.",
};
