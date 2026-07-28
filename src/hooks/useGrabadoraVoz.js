import { useState, useRef, useEffect, useCallback } from "react";
import { formatoGrabacion } from "../utils/audio";

// Tope de duración. No es capricho: el bucket admite 10 MB y, sobre todo, una nota de cinco
// minutos nadie la escucha. Al llegar, se corta sola y se conserva lo grabado.
const MAX_SEGUNDOS = 180;

/**
 * Grabación de notas de voz.
 *
 * Estados: "inactiva" | "pidiendo" | "grabando" | "no_disponible" | "denegada".
 *
 * El micrófono se apaga SIEMPRE al terminar, al cancelar y al desmontar. Es el mismo cuidado
 * que ya se tiene con la cámara en CapturaSelfie —donde el bug clásico era dejar la luz
 * encendida— y aquí importa más: un micro abierto sin aviso en una conversación con la
 * psicóloga es exactamente lo que nadie quiere ni sospechar.
 */
export const useGrabadoraVoz = ({ onLista }) => {
  const [estado, setEstado] = useState("inactiva");
  const [segundos, setSegundos] = useState(0);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const trozosRef = useRef([]);
  const relojRef = useRef(null);
  const cancelarRef = useRef(false);

  const soltarMicro = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearInterval(relojRef.current);
  }, []);

  // Al desmontar (cambiar de conversación, salir de la pantalla) no puede quedar nada abierto.
  useEffect(() => () => {
    try { recorderRef.current?.stop(); } catch { /* ya estaba parado */ }
    soltarMicro();
  }, [soltarMicro]);

  const empezar = useCallback(async () => {
    const mime = formatoGrabacion();
    if (!navigator.mediaDevices?.getUserMedia || !mime) {
      // Sin HTTPS `mediaDevices` no existe, y sin formato soportado MediaRecorder revienta con
      // un throw sin mensaje. Mejor decirlo que dejar un botón que no hace nada.
      setEstado("no_disponible");
      return;
    }

    setEstado("pidiendo");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.warn("No se pudo abrir el micrófono:", error?.name || error);
      setEstado("denegada");
      return;
    }

    streamRef.current = stream;
    trozosRef.current = [];
    cancelarRef.current = false;

    const rec = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = rec;

    rec.ondataavailable = (e) => { if (e.data.size) trozosRef.current.push(e.data); };

    rec.onstop = () => {
      soltarMicro();
      setEstado("inactiva");
      setSegundos(0);
      if (cancelarRef.current) return;   // se descartó a propósito
      const blob = new Blob(trozosRef.current, { type: mime });
      if (blob.size > 0) onLista(blob, mime);
    };

    rec.start();
    setEstado("grabando");
    setSegundos(0);

    relojRef.current = setInterval(() => {
      setSegundos((s) => {
        if (s + 1 >= MAX_SEGUNDOS) {
          // Se corta sola pero NO se descarta: quien hablaba tres minutos no quiere perderlos.
          try { rec.stop(); } catch { /* ya estaba parado */ }
          return MAX_SEGUNDOS;
        }
        return s + 1;
      });
    }, 1000);
  }, [onLista, soltarMicro]);

  const terminar = useCallback(() => {
    cancelarRef.current = false;
    try { recorderRef.current?.stop(); } catch { /* ya estaba parado */ }
  }, []);

  const cancelar = useCallback(() => {
    cancelarRef.current = true;
    try { recorderRef.current?.stop(); } catch { /* ya estaba parado */ }
  }, []);

  return { estado, segundos, empezar, terminar, cancelar, MAX_SEGUNDOS };
};
