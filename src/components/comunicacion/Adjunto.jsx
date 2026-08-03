import { useState, useEffect } from "react";
import Icon from "../ui/Icon";
import FotoAmpliada from "../ui/FotoAmpliada";
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

/**
 * La misma URL firmada, pero pidiéndole al almacén que la sirva como DESCARGA.
 *
 * Sin esto, pulsar un archivo del chat no descargaba: abría la URL firmada en otra pestaña, y
 * el navegador enseñaba el PDF o se quedaba en blanco con un .docx. El atributo `download` del
 * enlace no basta —solo manda cuando el archivo es del mismo origen, y aquí eso depende de cómo
 * esté servido el almacén—, mientras que `?download=` hace que el propio servidor responda con
 * `Content-Disposition: attachment` y el nombre real. Eso funciona siempre.
 */
const urlDeDescarga = (firmada, nombre) => {
  if (!firmada) return undefined;
  try {
    const u = new URL(firmada);
    u.searchParams.set("download", nombre || "");
    return u.toString();
  } catch {
    return firmada;
  }
};

const Adjunto = ({ adjunto }) => {
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
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
      <>
        {/* UN BOTÓN Y NO UN ENLACE. Antes era un `<a target="_blank">` a la URL firmada: eso
            saca de la app —en el móvil, a otra pestaña del navegador— y además esa URL caduca a
            los diez minutos, así que la pestaña abierta se quedaba con la imagen rota. Ahora se
            amplía aquí mismo, con el mismo visor que ya usaban las fotos de perfil. */}
        <button
          type="button"
          className="chat-adjunto-imagen"
          onClick={() => url && setAmpliada(true)}
          disabled={!url}
          title="Ver la imagen en grande"
          aria-label={`Ver ${adjunto.nombre || "la imagen"} en grande`}
          // Se reserva la proporción real antes de que cargue: sin esto la conversación pega un
          // salto al aparecer cada imagen y te mueve el texto que estabas leyendo.
          style={ancho && alto ? { aspectRatio: `${ancho} / ${alto}` } : undefined}
        >
          {url
            ? <img src={url} alt={adjunto.nombre || "Imagen"} loading="lazy" />
            : <span className="chat-adjunto-cargando" />}
        </button>

        {ampliada && (
          <FotoAmpliada
            src={url}
            alt={adjunto.nombre || "Imagen"}
            pie={adjunto.nombre}
            descargaHref={urlDeDescarga(url, adjunto.nombre)}
            descargaNombre={adjunto.nombre}
            onClose={() => setAmpliada(false)}
          />
        )}
      </>
    );
  }

  return (
    <a
      className="chat-adjunto"
      href={urlDeDescarga(url, adjunto.nombre)}
      download={adjunto.nombre}
    >
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
