import Icon from "../ui/Icon";

/**
 * Tarjeta de vista previa de un enlace.
 *
 * La imagen se carga desde el sitio de origen, así que abrir la conversación le dice a ese
 * servidor que alguien la está leyendo. Se limita lo que se puede: `referrerPolicy="no-referrer"`
 * para no contarle de dónde viene la visita, y `loading="lazy"` para no pedirla si la tarjeta
 * ni siquiera llega a verse. Guardar la imagen en nuestro storage lo evitaría del todo, pero
 * eso es copiar contenido ajeno a un bucket privado: es una decisión aparte.
 */
const EnlacePreview = ({ enlace }) => {
  if (!enlace?.url) return null;
  let host;
  try { host = new URL(enlace.url).hostname.replace(/^www\./, ""); } catch { host = enlace.url; }

  return (
    <a
      className="chat-enlace"
      href={enlace.url}
      target="_blank"
      rel="noreferrer noopener"
      referrerPolicy="no-referrer"
    >
      {enlace.imagen && (
        <img
          className="chat-enlace-imagen"
          src={enlace.imagen}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          // Si la imagen no carga (cambió, la borraron, la bloquea el navegador) se quita el
          // hueco en vez de dejar el icono de imagen rota.
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
      <span className="chat-enlace-datos">
        <span className="chat-enlace-host">
          <Icon name="link" size={12} /> {host}
        </span>
        {enlace.titulo && <span className="chat-enlace-titulo">{enlace.titulo}</span>}
        {enlace.descripcion && <span className="chat-enlace-desc">{enlace.descripcion}</span>}
      </span>
    </a>
  );
};

export default EnlacePreview;
