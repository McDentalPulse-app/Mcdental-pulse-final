import { useState, useEffect } from "react";
import Icon from "../ui/Icon";
import { getSignedUrlAdjunto } from "../../services/supabase/mensajesService";
import { formatoPeso, etiquetaTipo } from "../../utils/archivo";

/**
 * Adjunto de un mensaje: imagen o archivo.
 *
 * El bucket es privado, así que no hay URL fija que poner en el `src`. Se pide una URL firmada
 * al montar y se renueva sola antes de caducar: si no, una conversación abierta un rato acaba
 * con todas las imágenes rotas y sin ninguna pista de por qué.
 */
const MINUTOS_FIRMA = 10;

const Adjunto = ({ adjunto }) => {
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);
  const esImagen = (adjunto?.mime || "").startsWith("image/");

  useEffect(() => {
    let vivo = true;
    let temporizador;

    const pedir = async () => {
      const firmada = await getSignedUrlAdjunto(adjunto.path, MINUTOS_FIRMA * 60);
      if (!vivo) return;
      if (!firmada) { setFallo(true); return; }
      setUrl(firmada);
      // Se renueva un minuto antes de que caduque, para que no llegue a romperse.
      temporizador = setTimeout(pedir, (MINUTOS_FIRMA - 1) * 60 * 1000);
    };
    pedir();

    return () => { vivo = false; clearTimeout(temporizador); };
  }, [adjunto.path]);

  if (fallo) {
    return (
      <div className="chat-adjunto chat-adjunto--fallo">
        <Icon name="alert" size={16} />
        <span>No se pudo abrir el archivo.</span>
      </div>
    );
  }

  if (esImagen) {
    const { ancho, alto } = adjunto.meta || {};
    return (
      <a
        className="chat-adjunto-imagen"
        href={url || undefined}
        target="_blank"
        rel="noreferrer"
        // Se reserva la proporción real antes de que cargue: sin esto la conversación pega un
        // salto al aparecer cada imagen y te mueve el texto que estabas leyendo.
        style={ancho && alto ? { aspectRatio: `${ancho} / ${alto}` } : undefined}
      >
        {url
          ? <img src={url} alt={adjunto.nombre || "Imagen"} loading="lazy" />
          : <span className="chat-adjunto-cargando" />}
      </a>
    );
  }

  return (
    <a className="chat-adjunto" href={url || undefined} target="_blank" rel="noreferrer" download={adjunto.nombre}>
      <span className="chat-adjunto-icono">{etiquetaTipo(adjunto.nombre, adjunto.mime)}</span>
      <span className="chat-adjunto-datos">
        <span className="chat-adjunto-nombre">{adjunto.nombre}</span>
        <span className="chat-adjunto-peso">{formatoPeso(adjunto.bytes)}</span>
      </span>
      <Icon name="download" size={16} className="chat-adjunto-bajar" />
    </a>
  );
};

export default Adjunto;
