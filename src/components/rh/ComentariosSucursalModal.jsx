import Icon from "../ui/Icon";
import NominaSucursal from "./NominaSucursal";

/**
 * Paso previo a "Imprimir nómina de sucursal" (Nomina.jsx): antes de mandar a imprimir, deja
 * escribir —si se quiere, es opcional— un comentario por persona directo en la celda de la
 * hoja, viendo ya el mismo diseño del recibo (mismo NominaSucursal.jsx, en modo `editable`)
 * en vez de una lista de campos aparte que no se parece a lo que sale impreso.
 */
export default function ComentariosSucursalModal({ sucursal, recibos, desde, hasta, comentarios, onCambiarComentario, onQuitarEmpleado, onImprimir, onCerrar }) {
  return (
    <div className="mc-modal-overlay" onClick={onCerrar} role="presentation">
      <div
        className="mc-modal nomina-comentarios-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nomina-comentarios-titulo"
      >
        <h2 id="nomina-comentarios-titulo" className="mc-modal-title mc-btn-with-icon">
          <Icon name="printer" size={20} />
          Nómina de {sucursal}
        </h2>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          <span>Si quieres, dale clic a la celda de "Comentarios" de cada quien y escribe — es opcional, puedes dejarla en blanco. El bote de basura junto al nombre la quita de esta impresión.</span>
        </p>

        <div className="nomina-comentarios-preview">
          <NominaSucursal
            sucursal={sucursal}
            recibos={recibos}
            desde={desde}
            hasta={hasta}
            comentarios={comentarios}
            onCambiarComentario={onCambiarComentario}
            onQuitarEmpleado={onQuitarEmpleado}
            editable
          />
        </div>

        <div className="mc-form-actions">
          <button type="button" className="mc-btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={onImprimir}>
            <Icon name="printer" size={16} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
