import { useState } from "react";
import Icon from "../ui/Icon";
import ReciboImagen from "./ReciboImagen";

const ESTADO_LABEL = { pendiente: "Pendiente", valida: "Válida", invalida: "Inválida" };

// Fila de un recibo, COLAPSADA por defecto: solo cabecera (fecha, quién lo mandó, estado). La
// foto y las acciones se muestran al desplegar — así la pantalla no es un muro de imágenes.
// `mostrarDoctor` añade el nombre de quien lo subió (lado RH cuando no está agrupado por doctor).
// `children` son las acciones (botones de RH), que van bajo la foto al desplegar.
const ComisionItem = ({ comision, mostrarDoctor = false, children }) => {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className={`comision-item ${abierto ? "comision-item--abierto" : ""}`}>
      <button
        type="button"
        className="comision-item-head"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className="comision-item-icono"><Icon name="file" size={16} /></span>
        <span className="comision-item-info">
          {mostrarDoctor && <span className="comision-item-doctor">{comision.doctor}</span>}
          <span className="comision-item-fecha">{comision.fecha}</span>
          {comision.nota && <span className="comision-item-nota">{comision.nota}</span>}
        </span>
        <span className={`mc-status-pill mc-status-pill--${comision.estado}`}>{ESTADO_LABEL[comision.estado]}</span>
        <span className={`comision-item-chevron ${abierto ? "comision-item-chevron--abierto" : ""}`}>
          <Icon name="chevronDown" size={16} />
        </span>
      </button>

      {abierto && (
        <div className="comision-item-body">
          <ReciboImagen fotoPath={comision.fotoPath} alt={`Recibo ${comision.fecha}`} />
          {comision.comentarioRH && <div className="comision-item-comentario">RH: {comision.comentarioRH}</div>}
          {children}
        </div>
      )}
    </div>
  );
};

export default ComisionItem;
