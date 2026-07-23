import { useState } from "react";
import Icon from "../ui/Icon";

// Sección colapsable que agrupa recibos (por doctor en RH, por estado en el doctor). La cabecera
// muestra el título, un subtítulo opcional y un contador; el cuerpo (las filas) se despliega al
// hacer clic. `defaultAbierto` deja abierto lo importante (p. ej. lo pendiente).
const ComisionGrupo = ({ titulo, subtitulo, conteo, pendientes = 0, defaultAbierto = false, children }) => {
  const [abierto, setAbierto] = useState(defaultAbierto);

  return (
    <div className={`comision-grupo ${abierto ? "comision-grupo--abierto" : ""}`}>
      <button
        type="button"
        className="comision-grupo-head"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className="comision-grupo-titulo">
          <strong>{titulo}</strong>
          {subtitulo && <span className="comision-grupo-sub">{subtitulo}</span>}
        </span>
        {pendientes > 0 && <span className="comision-grupo-badge">{pendientes} pendiente{pendientes > 1 ? "s" : ""}</span>}
        <span className="comision-grupo-conteo">{conteo}</span>
        <span className={`comision-item-chevron ${abierto ? "comision-item-chevron--abierto" : ""}`}>
          <Icon name="chevronDown" size={18} />
        </span>
      </button>

      {abierto && <div className="comision-grupo-body">{children}</div>}
    </div>
  );
};

export default ComisionGrupo;
