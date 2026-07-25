/**
 * Escáner de documentos para las comisiones: detecta el rectángulo del recibo, endereza la
 * perspectiva y lo recorta. Envuelve OpenCV.js (~13 MB) + jscanify, que se cargan de forma
 * PEREZOSA (dynamic import) solo cuando se abre la cámara de comisiones — nunca en el arranque.
 *
 * Cuidado con la memoria: jscanify pide Mats a OpenCV y NO libera el contorno que devuelve
 * `findPaperContour`. En un bucle en vivo eso fuga memoria rápido, así que aquí SIEMPRE se
 * liberan (`.delete()`) los Mats que se crean.
 */

let scannerPromise = null;

// Carga OpenCV + jscanify una sola vez (memoizado). Devuelve { cv, scanner }.
export const cargarEscaner = () => {
  if (scannerPromise) return scannerPromise;

  scannerPromise = (async () => {
    const mod = await import("@techstark/opencv-js");
    // En @techstark v5 el export por defecto es una promesa que resuelve al objeto cv cuando
    // el runtime wasm está listo. Si ya viene inicializado, se usa directo.
    const candidato = mod.default ?? mod;
    const cv = candidato && candidato.imread ? candidato : await candidato;

    // jscanify usa un `cv` global.
    window.cv = cv;
    // 'jscanify/client' es la build de navegador; el import por defecto ('.') es la de Node y
    // arrastra el paquete nativo `canvas`, que no se puede bundlear para el navegador.
    const { default: Jscanify } = await import("jscanify/client");
    return { cv, scanner: new Jscanify() };
  })();

  return scannerPromise;
};

// Ordena 4 puntos {x,y} en {topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner}.
// Usa suma y resta de coordenadas: la esquina superior-izquierda tiene la menor x+y, la
// inferior-derecha la mayor; la superior-derecha la menor y-x, la inferior-izquierda la mayor.
const ordenarEsquinas = (pts) => {
  const suma = (p) => p.x + p.y;
  const resta = (p) => p.y - p.x;
  const min = (fn) => pts.reduce((a, b) => (fn(b) < fn(a) ? b : a));
  const max = (fn) => pts.reduce((a, b) => (fn(b) > fn(a) ? b : a));
  return {
    topLeftCorner: min(suma),
    bottomRightCorner: max(suma),
    topRightCorner: min(resta),
    bottomLeftCorner: max(resta),
  };
};

// ¿Los 4 puntos forman un cuadrilátero sano? Sin lados degenerados ni casi-colineales.
const cuadrilateroSano = (c) => {
  const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br, bottomLeftCorner: bl } = c;
  const lados = [dist(tl, tr), dist(tr, br), dist(br, bl), dist(bl, tl)];
  const minLado = Math.min(...lados);
  const maxLado = Math.max(...lados);
  // Todos los lados con largo real y sin una relación absurda (un lado 8x otro = no es papel).
  return minLado > 20 && maxLado / minLado < 8;
};

/**
 * Detecta las 4 esquinas del recibo en un canvas fuente. Pipeline propio (más robusto que el de
 * jscanify): Canny + dilatación cierra los bordes aunque haya sombra o poco contraste;
 * approxPolyDP busca un contorno de 4 vértices CONVEXO (un papel de verdad, no una mancha); si
 * no aparece, cae a minAreaRect del contorno más grande (rectángulo rotado que envuelve el
 * papel). Devuelve {topLeftCorner,...} en píxeles del canvas, o null. Libera todos los Mats.
 */
export const detectarEsquinas = ({ cv }, canvasFuente) => {
  const areaImg = canvasFuente.width * canvasFuente.height;
  const src = cv.imread(canvasFuente);
  const gris = new cv.Mat();
  const suave = new cv.Mat();
  const bordes = new cv.Mat();
  const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
  const contornos = new cv.MatVector();
  const jerarquia = new cv.Mat();
  let mejorQuad = null;      // approxPolyDP de 4 vértices convexo (lo ideal)
  let mejorQuadArea = 0;
  let mayorContorno = null;  // el contorno más grande (para el respaldo minAreaRect)
  let mayorArea = 0;

  try {
    cv.cvtColor(src, gris, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gris, suave, new cv.Size(5, 5), 0);
    cv.Canny(suave, bordes, 75, 200);
    cv.dilate(bordes, bordes, kernel); // cierra huecos de los bordes
    cv.findContours(bordes, contornos, jerarquia, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contornos.size(); i++) {
      const cnt = contornos.get(i);
      const area = cv.contourArea(cnt);
      if (area < 0.1 * areaImg) { cnt.delete(); continue; } // muy chico = ruido

      if (area > mayorArea) {
        mayorArea = area;
        mayorContorno?.delete();
        mayorContorno = cnt.clone();
      }

      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true);
      if (approx.rows === 4 && cv.isContourConvex(approx) && area > mejorQuadArea) {
        mejorQuadArea = area;
        mejorQuad?.delete();
        mejorQuad = approx;
      } else {
        approx.delete();
      }
      cnt.delete();
    }

    let pts = null;
    if (mejorQuad) {
      const d = mejorQuad.data32S;
      pts = [0, 1, 2, 3].map((i) => ({ x: d[i * 2], y: d[i * 2 + 1] }));
    } else if (mayorContorno) {
      // Respaldo: el rectángulo rotado que mejor envuelve el contorno más grande.
      const rect = cv.minAreaRect(mayorContorno);
      pts = cv.RotatedRect.points(rect).map((p) => ({ x: p.x, y: p.y }));
    }
    if (!pts) return null;

    const esquinas = ordenarEsquinas(pts);
    return cuadrilateroSano(esquinas) ? esquinas : null;
  } catch (error) {
    console.warn("Error detectando el recibo:", error);
    return null;
  } finally {
    src.delete(); gris.delete(); suave.delete(); bordes.delete();
    kernel.delete(); contornos.delete(); jerarquia.delete();
    mejorQuad?.delete(); mayorContorno?.delete();
  }
};

// Distancia euclidiana entre dos esquinas {x,y}.
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Recorta y endereza el recibo a partir de un canvas fuente y sus esquinas. El tamaño de salida
 * se calcula de las propias esquinas para conservar la proporción real del papel. Devuelve un
 * canvas con el recibo ya recortado y de frente, o null si algo falla.
 */
export const recortarRecibo = ({ scanner }, canvasFuente, esquinas) => {
  const { topLeftCorner: tl, topRightCorner: tr, bottomLeftCorner: bl, bottomRightCorner: br } = esquinas;
  const ancho = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
  const alto = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
  if (ancho < 40 || alto < 40) return null;

  try {
    // extractPaper hace la transformación de perspectiva (warp) al tamaño dado.
    return scanner.extractPaper(canvasFuente, ancho, alto, esquinas);
  } catch (error) {
    console.warn("Error recortando el recibo:", error);
    return null;
  }
};
