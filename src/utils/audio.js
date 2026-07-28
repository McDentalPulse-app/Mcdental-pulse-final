// Número de barras de la onda. Con menos se pierde el ritmo de la voz; con muchas más, en el
// ancho de una burbuja las barras quedan a menos de un píxel y se ve un bloque gris.
const BARRAS = 48;

/**
 * Analiza una nota de voz: duración real y picos para dibujar la onda.
 *
 * LA ONDA SE CALCULA DE VERDAD, no se simula. Dibujar barras al azar quedaría igual de bonito
 * y sería mentir sobre el contenido: en una nota de voz la forma dice dónde hay habla y dónde
 * silencio, y quien la escucha la usa para orientarse al arrastrar.
 *
 * Se hace en el navegador y una sola vez, al grabar. El resultado viaja en `adjunto_meta`, así
 * que quien la recibe no tiene que descargar y decodificar el audio entero solo para pintarla.
 *
 * Devuelve { picos: number[0..1], duracion: segundos }. Si algo falla devuelve picos vacíos:
 * el reproductor sabe apañárselas sin onda, y perder el dibujo no puede impedir mandar la nota.
 */
export const analizarAudio = async (blob) => {
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return { picos: [], duracion: 0 };

    const ctx = new Contexto();
    try {
      const datos = await ctx.decodeAudioData(await blob.arrayBuffer());
      const muestras = datos.getChannelData(0);
      const porBarra = Math.floor(muestras.length / BARRAS) || 1;

      const picos = [];
      for (let i = 0; i < BARRAS; i++) {
        let max = 0;
        const desde = i * porBarra;
        const hasta = Math.min(desde + porBarra, muestras.length);
        for (let j = desde; j < hasta; j++) {
          const v = Math.abs(muestras[j]);
          if (v > max) max = v;
        }
        picos.push(max);
      }

      // Normalizar contra el pico más alto: una nota grabada bajito se vería como una línea
      // plana si se escalara contra el máximo teórico de 1.
      const techo = Math.max(...picos, 0.01);
      return {
        picos: picos.map((p) => Math.round((p / techo) * 100) / 100),
        duracion: Math.round(datos.duration * 10) / 10,
      };
    } finally {
      // Cerrar siempre: los navegadores limitan cuántos AudioContext pueden existir a la vez,
      // y grabar varias notas seguidas sin cerrarlos deja de funcionar sin decir por qué.
      ctx.close();
    }
  } catch (error) {
    console.warn("No se pudo analizar el audio:", error);
    return { picos: [], duracion: 0 };
  }
};

/** "0:07", "1:24". Para la duración de la nota. */
export const formatoDuracion = (segundos) => {
  const s = Math.max(0, Math.round(segundos || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Formato de grabación que soporta ESTE navegador.
 *
 * No hay uno universal: Chrome y Android graban en webm/opus, pero Safari e iOS no lo admiten
 * y usan mp4/aac. Fijar uno solo dejaría a la mitad de la plantilla sin poder mandar notas —
 * y en iOS el fallo de MediaRecorder es un throw seco, sin mensaje útil.
 */
export const formatoGrabacion = () => {
  const candidatos = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return null;
  return candidatos.find((t) => MediaRecorder.isTypeSupported(t)) || null;
};
