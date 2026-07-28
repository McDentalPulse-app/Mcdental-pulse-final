import { useState, useRef, useEffect } from "react";
import Icon from "../ui/Icon";
import { formatoDuracion } from "../../utils/audio";
import { getSignedUrlAdjunto } from "../../services/supabase/mensajesService";

const MINUTOS_FIRMA = 10;

/**
 * Reproductor de una nota de voz, con la onda calculada al grabarla (`adjunto_meta.picos`).
 *
 * Las barras se pintan con divs y no con canvas: son 48, no hace falta un lienzo, y así
 * heredan los colores del tema —claro y oscuro— sin redibujar al cambiarlo.
 *
 * Si la nota no trae picos (el análisis falló en el navegador que la grabó) se cae a una barra
 * de progreso normal. Antes eso que inventar una onda que no corresponde al audio.
 */
const AudioMensaje = ({ adjunto }) => {
  const [url, setUrl] = useState(null);
  const [sonando, setSonando] = useState(false);
  const [posicion, setPosicion] = useState(0);
  // La duración vive en estado y no se lee del <audio> al pintar: leer un ref durante el
  // render devuelve lo que hubiera en el repintado anterior y no vuelve a dibujar cuando
  // cambia, así que el tiempo se quedaría clavado en 0:00.
  const [duracionReal, setDuracionReal] = useState(0);
  const audioRef = useRef(null);

  const picos = adjunto.meta?.picos || [];
  // La de la metadata sirve de respaldo: se ve el tiempo antes incluso de cargar el audio.
  const total = duracionReal || adjunto.meta?.duracion || 0;
  const avance = total ? Math.min(1, posicion / total) : 0;

  useEffect(() => {
    let vivo = true;
    let temporizador;
    const pedir = async () => {
      const firmada = await getSignedUrlAdjunto(adjunto.path, MINUTOS_FIRMA * 60);
      if (!vivo) return;
      setUrl(firmada);
      temporizador = setTimeout(pedir, (MINUTOS_FIRMA - 1) * 60 * 1000);
    };
    pedir();
    return () => { vivo = false; clearTimeout(temporizador); };
  }, [adjunto.path]);

  const alternar = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setSonando(true); } else { a.pause(); setSonando(false); }
  };

  // Saltar a un punto pulsando la onda. Es lo que hace útil dibujarla: se ve dónde hay habla.
  const saltarA = (i) => {
    const a = audioRef.current;
    if (!a || !picos.length || !a.duration) return;
    a.currentTime = (i / picos.length) * a.duration;
    if (a.paused) { a.play(); setSonando(true); }
  };

  return (
    <div className="chat-audio">
      <button
        type="button"
        className="chat-audio-play"
        onClick={alternar}
        disabled={!url}
        aria-label={sonando ? "Pausar" : "Reproducir"}
      >
        <Icon name={sonando ? "pause" : "play"} size={18} />
      </button>

      {picos.length > 0 ? (
        <div className="chat-audio-onda" role="presentation">
          {picos.map((p, i) => (
            <span
              key={i}
              className={`chat-audio-barra${i / picos.length <= avance ? " chat-audio-barra--oida" : ""}`}
              // Un mínimo del 12%: un silencio con altura cero deja huecos y parece que faltan
              // barras, en vez de que ahí no se hablaba.
              style={{ height: `${Math.max(12, p * 100)}%` }}
              onClick={() => saltarA(i)}
            />
          ))}
        </div>
      ) : (
        <div className="chat-audio-barra-simple">
          <span style={{ width: `${avance * 100}%` }} />
        </div>
      )}

      <span className="chat-audio-tiempo">
        {formatoDuracion(posicion > 0 ? posicion : total)}
      </span>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => {
            // Infinity aparece en webm sin cabecera de duración (pasa con lo que graba
            // MediaRecorder): en ese caso manda la duración que calculamos al grabar.
            const d = e.target.duration;
            setDuracionReal(Number.isFinite(d) ? d : 0);
          }}
          onTimeUpdate={(e) => setPosicion(e.target.currentTime)}
          onEnded={() => { setSonando(false); setPosicion(0); }}
        />
      )}
    </div>
  );
};

export default AudioMensaje;
