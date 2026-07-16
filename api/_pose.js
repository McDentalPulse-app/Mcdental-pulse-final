/**
 * La geometría del reto de movimiento. Pura: entran puntos, sale un número.
 *
 * POR QUÉ ESTO PARA LA FOTO DE UNA FOTO:
 *
 * Una foto plana NO PUEDE GIRAR LA CABEZA. Cuando alguien rota una foto impresa (o un móvil con
 * la cara de otro en la pantalla) delante de la cámara, la imagen se comprime horizontalmente,
 * sí — pero la nariz NO se desplaza respecto a los ojos, porque en una foto no hay relieve y no
 * hay paralaje. Una cabeza de verdad sí: al girar, la nariz se acerca al ojo del lado hacia el
 * que se gira. Esa diferencia es lo que se mide aquí, y es la señal más barata y más difícil de
 * falsear que tenemos.
 *
 * ESTO VIVE EN EL SERVIDOR Y NO EN EL NAVEGADOR, y ahí está todo el asunto: si el cliente
 * pudiera mandar "reto superado: sí", el reto no valdría absolutamente nada. Es la misma lección
 * que con el match_score. El navegador GUÍA (le dice a la persona hacia dónde girar); el
 * servidor JUZGA, recalculando la pose de la foto que le llegó.
 */

export const POSE = {
  DERECHA: "derecha",     // la persona gira la cabeza hacia SU derecha
  IZQUIERDA: "izquierda",
};

/**
 * Cuánto tiene que haberse movido la nariz para que cuente como giro, medido desde el centro.
 *
 * El navegador exige MÁS que esto (0.16) antes de dejar tomar la foto. Es a propósito: si el
 * servidor fuera más estricto que el guía, la persona vería "perfecto" en pantalla y el servidor
 * la rechazaría después — y no habría forma humana de entender por qué. El que guía pide de más;
 * el que juzga acepta un poco menos.
 *
 * Y ser generoso aquí no regala nada al tramposo: una foto girada mantiene la nariz clavada en
 * 0.5 (no hay paralaje), así que ni de lejos llega a 0.12.
 */
export const GIRO_MINIMO = 0.12;

/**
 * Dónde cae la nariz sobre la línea que une los ojos.
 *
 * 0 = pegada al ojo derecho · 0.5 = en medio (cara de frente) · 1 = pegada al izquierdo.
 *
 * Se PROYECTA sobre la línea de los ojos en vez de mirar solo la coordenada X, y eso importa:
 * todo el mundo inclina la cabeza al mirarse en el móvil, y con la X a secas una cabeza ladeada
 * parecería estar de perfil. Proyectando, la inclinación no ensucia la medida.
 */
export const proyectarNariz = (puntos) => {
  if (!puntos || puntos.length < 3) return null;

  // YuNet devuelve, en este orden: ojo derecho, ojo izquierdo, nariz, comisura derecha,
  // comisura izquierda. (Es el mismo orden que usa MediaPipe en el navegador.)
  const [ojoDerecho, ojoIzquierdo, nariz] = puntos;

  const ex = ojoIzquierdo[0] - ojoDerecho[0];
  const ey = ojoIzquierdo[1] - ojoDerecho[1];
  const largo2 = ex * ex + ey * ey;
  if (!largo2) return null;

  return ((nariz[0] - ojoDerecho[0]) * ex + (nariz[1] - ojoDerecho[1]) * ey) / largo2;
};

/**
 * ¿La cabeza giró de verdad hacia donde se le pidió?
 *
 * La imagen que se analiza NO está espejada (el espejo del checador es solo un efecto de CSS
 * para que la persona se vea como en un espejo). Así que el ojo derecho de la persona cae a la
 * izquierda de la imagen: al girar hacia SU derecha, la nariz se mueve hacia allí y `t` BAJA.
 */
export const giroCorrecto = (t, poseRequerida) => {
  if (t == null || !poseRequerida) return false;
  if (poseRequerida === POSE.DERECHA) return t <= 0.5 - GIRO_MINIMO;
  if (poseRequerida === POSE.IZQUIERDA) return t >= 0.5 + GIRO_MINIMO;
  return false;
};

/** Un reto al azar. Se sortea en el SERVIDOR: si lo eligiera el cliente, elegiría el que ya tiene resuelto. */
export const retoAlAzar = () => (Math.random() < 0.5 ? POSE.DERECHA : POSE.IZQUIERDA);

/**
 * Cada cuántas checadas se pide el reto.
 *
 * ACTUALIZACIÓN (2026-07-16): estaba en 0.2 (1 de cada 5) para no cansar a la plantilla, pero
 * eso deja 4 de cada 5 checadas SIN ninguna barrera contra una foto impresa o de pantalla —
 * confirmado en vivo: una foto delante de la cámara dejó marcar asistencia. Hasta que exista
 * un anti-spoofing real y calibrado (ver UMBRAL_ANTISPOOF_OBVIO en _rostro.js, todavía
 * conservador), el reto es la única barrera contra "mostrar la foto de otro y girar tu propia
 * cabeza" — así que se pide SIEMPRE. Más fricción diaria a cambio de cerrar el ataque más
 * fácil de hacer. Bajarlo otra vez solo si el anti-spoofing calibrado lo hace innecesario.
 *
 * El sorteo tiene una regla que lo sostiene todo (ver api/reto.js): una vez que sale, SE QUEDA
 * PEGADO hasta que se pase. Si fallar el reto permitiera volver a tirar el dado, bastaría con
 * reintentar hasta que saliera "sin reto" — y el reto sería puro teatro.
 */
export const PROBABILIDAD_RETO = 1.0;
