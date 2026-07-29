import { useState, useEffect } from "react";
import Icon from "../ui/Icon";
import { buscarActualizacion } from "../../utils/appUpdate";
import { estadoActualizacion, alCambiarActualizacion } from "../../utils/actualizacion";

/**
 * Aviso OBLIGATORIO de versión nueva. Sin botón de cerrar, sin cancelar, sin click-afuera y sin
 * Escape: el único camino es "Actualizar ahora".
 *
 * Antes era un toast descartable, y un toast que se ignora deja a la gente usando código viejo
 * contra una base que ya cambió — que es el peor sitio donde puede pasar un despliegue a medias.
 * Mismo criterio que AvisoModal: si se pudiera saltar, se saltaría.
 *
 * La ÚNICA excepción es una checada en curso (ver utils/actualizacion.js): mientras la cámara
 * está abierta el aviso espera, y aparece en cuanto se cierra. Bloquear ahí no adelantaría la
 * actualización, solo le quitaría a alguien su checada.
 */
export default function ModalActualizacion() {
  const [estado, setEstado] = useState(estadoActualizacion);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => alCambiarActualizacion(() => setEstado(estadoActualizacion())), []);

  if (!estado.versionNueva || estado.checadaEnCurso) return null;

  const actualizar = () => {
    setActualizando(true);   // buscarActualizacion() acaba en un reload: no hay vuelta de esto
    buscarActualizacion();
  };

  return (
    <div className="mc-modal-overlay mc-notify-overlay" role="presentation">
      <div
        className="mc-modal mc-notify-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="actualizacion-modal-title"
      >
        <div className="mc-notify-modal-icon mc-notify-modal-icon--info">
          <Icon name="refresh" size={22} />
        </div>
        <h2 id="actualizacion-modal-title" className="mc-notify-modal-title">
          Hay una versión nueva
        </h2>
        <p className="mc-notify-modal-desc">
          Para seguir usando McDental Pulse hay que actualizar. Tarda unos segundos y no perderás
          nada de lo que ya guardaste.
        </p>
        <div className="mc-notify-modal-actions">
          <button
            type="button"
            className="mc-btn-primary mc-btn-with-icon"
            onClick={actualizar}
            disabled={actualizando}
          >
            <Icon name="refresh" size={16} />
            {actualizando ? "Actualizando…" : "Actualizar ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
