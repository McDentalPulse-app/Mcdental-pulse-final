import { useCallback, useEffect, useRef } from "react";

// Narración por voz del checador (Web Speech API del navegador: nativa, sin librerías, sin red
// y sin coste). Da de viva voz las mismas pistas que ya salen en pantalla —"acércate", "gira la
// cabeza", "no te muevas"— más la confirmación de la checada. Pensada para quien no está mirando
// la pantalla mientras se encuadra.

const disponible = typeof window !== "undefined" && "speechSynthesis" in window;

// Elige una voz en español. Las voces cargan de forma asíncrona en varios navegadores, así que
// puede devolver null la primera vez; el hook reintenta con el evento `voiceschanged`. Se prefiere
// español de México y, si no, cualquier español antes que la voz por defecto (que suele ser inglés).
const elegirVozES = () => {
  if (!disponible) return null;
  const voces = window.speechSynthesis.getVoices();
  if (!voces.length) return null;
  return (
    voces.find((v) => /^es[-_]MX/i.test(v.lang)) ||
    voces.find((v) => /^es[-_](419|US)/i.test(v.lang)) ||
    voces.find((v) => /^es/i.test(v.lang)) ||
    null
  );
};

/**
 * Frase de confirmación de la checada. Pura y sin formato de hora (se le pasa ya formateada) para
 * poder probarla sin depender del navegador ni del reloj.
 */
export const construirFraseChecada = (tipo, hora, { tarde = false, fuera = false } = {}) => {
  const base =
    tipo === "entrada"
      ? `Entrada registrada a las ${hora}${tarde ? ", con retardo" : ""}.`
      : `Salida registrada a las ${hora}. Buen día.`;
  return fuera ? `${base} Ojo, registraste fuera de la sucursal.` : base;
};

/**
 * Hook de voz. `activa` la enciende o apaga; al apagarla (o al desmontar) calla lo que esté
 * sonando. Devuelve `hablar(texto)` y `callar()`.
 *
 * `hablar` de-duplica: el bucle de guía re-emite la misma pista cada 350 ms, y sin esto la voz se
 * reiniciaría a trompicones. La misma frase no se repite si se dijo hace menos de 4 s (salvo que se
 * pida `repetir`, para confirmaciones y errores, que sí deben oírse aunque coincidan con la previa).
 */
export function useVoz(activa) {
  const vozRef = useRef(null);
  const ultimoRef = useRef({ texto: "", en: 0 });

  useEffect(() => {
    if (!disponible) return undefined;
    const cargar = () => { vozRef.current = elegirVozES(); };
    cargar();
    window.speechSynthesis.addEventListener("voiceschanged", cargar);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", cargar);
  }, []);

  useEffect(() => {
    if (!disponible) return undefined;
    if (!activa) window.speechSynthesis.cancel();
    // Al salir de la pantalla, que no se quede una frase sonando sola.
    return () => window.speechSynthesis.cancel();
  }, [activa]);

  const hablar = useCallback(
    (texto, { interrumpe = true, repetir = false } = {}) => {
      if (!activa || !disponible || !texto) return;
      const ahora = Date.now();
      if (!repetir && texto === ultimoRef.current.texto && ahora - ultimoRef.current.en < 4000) return;
      ultimoRef.current = { texto, en: ahora };

      const synth = window.speechSynthesis;
      // Interrumpir la frase anterior mantiene la voz al día con lo que pasa: decir "acércate" tres
      // segundos después de que la persona ya se acercó es peor que callar.
      if (interrumpe) synth.cancel();

      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "es-MX";
      u.rate = 1.05;
      if (vozRef.current) u.voice = vozRef.current;
      synth.speak(u);
    },
    [activa],
  );

  const callar = useCallback(() => { if (disponible) window.speechSynthesis.cancel(); }, []);

  return { hablar, callar, disponible };
}
