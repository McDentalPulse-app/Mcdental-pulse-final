import React, { useEffect, useState } from "react";
import { getSignedUrlComision } from "../../services/supabase/comisionesService";
import Icon from "../ui/Icon";

// El bucket de comisiones es privado: la foto solo se ve con una URL firmada de vida corta,
// que se pide on-demand. Este componente la resuelve al montarse y muestra la miniatura; al
// hacer clic abre la imagen completa en otra pestaña.
const ReciboImagen = ({ fotoPath, alt = "Recibo" }) => {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    getSignedUrlComision(fotoPath)
      .then((u) => { if (vivo) setUrl(u); })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [fotoPath]);

  if (error) {
    return (
      <div className="comision-recibo comision-recibo--error">
        <Icon name="xCircle" size={18} /> No se pudo cargar
      </div>
    );
  }

  if (!url) {
    return <div className="comision-recibo comision-recibo--loading" aria-busy="true" />;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="comision-recibo" title="Ver recibo completo">
      <img src={url} alt={alt} loading="lazy" />
    </a>
  );
};

export default ReciboImagen;
