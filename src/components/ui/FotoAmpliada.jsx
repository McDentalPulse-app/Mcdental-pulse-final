import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Una imagen a pantalla completa, sobre un fondo oscuro.
 *
 * VA EN UN PORTAL A <body> A PROPÓSITO. Quien la abre vive dentro de tablas, de listas con
 * `overflow-y: auto` y de tarjetas con `overflow: hidden`; un overlay `position: fixed` dentro
 * de un ancestro con `transform` u `overflow` se recorta y saldría a medias. Además así el
 * overlay nunca queda anidado dentro de la fila que lo abrió.
 *
 * Estaba dentro de Avatar.jsx y solo servía para las fotos de perfil. Se saca aquí porque el
 * chat necesitaba lo mismo: las imágenes que llegan por mensaje no se podían ampliar — al
 * picarlas se abría la URL firmada en otra pestaña, que en el móvil saca de la app y encima
 * caduca a los diez minutos.
 */
const FotoAmpliada = ({ src, alt, pie, onClose, descargaHref, descargaNombre }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="mc-modal-overlay mc-foto-overlay" onClick={onClose} role="presentation">
      <div
        className="mc-foto-modal"
        role="dialog"
        aria-modal="true"
        aria-label={alt || "Imagen"}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="mc-foto-cerrar" onClick={onClose} aria-label="Cerrar la imagen">
          &times;
        </button>

        <img className="mc-foto-img" src={src} alt={alt || "Imagen"} />

        {(pie || descargaHref) && (
          <div className="mc-foto-pie">
            {pie}
            {descargaHref && (
              // `download` con el nombre real: sin él el archivo se guarda con el nombre del
              // objeto en el almacén, que es un identificador y no dice nada.
              <a className="mc-foto-descargar" href={descargaHref} download={descargaNombre || true}>
                Descargar
              </a>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FotoAmpliada;
