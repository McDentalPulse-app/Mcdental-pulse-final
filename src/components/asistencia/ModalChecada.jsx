import { useEffect, useRef } from "react";
import Icon from "../ui/Icon";

/**
 * Confirmación de que la checada quedó registrada.
 *
 * POR QUÉ UN MODAL Y NO EL TOAST QUE YA HABÍA: al terminar de checar, la pantalla se quedaba
 * con el recuadro de la cámara en negro y la voz guía repitiendo "colócate frente a la cámara"
 * (ver CapturaSelfie). Entre eso y un toast que se va solo en unos segundos, la gente no sabía
 * si había fichado o no — y volvía a intentarlo, que es la peor respuesta posible: la segunda
 * checada del día es la SALIDA. Un aviso en medio de la pantalla, con la hora escrita, no deja
 * lugar a la duda.
 *
 * SE CIERRA SOLO A LOS 8 SEGUNDOS, y también con el botón. Al revés que el aviso de versión
 * nueva —que es obligatorio y no se puede saltar— este no tiene por qué exigir un toque: son
 * las ocho de la mañana, con el teléfono en una mano, y quien se lo guarde en el bolsillo sin
 * pulsar no puede quedarse con la pantalla bloqueada. El botón está para quien sí quiera
 * quitarlo antes.
 */
const CIERRE_MS = 8000;

export default function ModalChecada({ tipo, hora, tarde = false, fuera = false, onCerrar }) {
  // onCerrar vive en un ref para que el temporizador se arme UNA sola vez. Si dependiera del
  // callback, cada render del padre reiniciaría la cuenta y el modal no se cerraría nunca.
  // La asignación va dentro de un efecto, no en el render: tocar un ref mientras se renderiza
  // es justo lo que React pide no hacer.
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);

  useEffect(() => {
    // Se limpia al desmontar: si no, cerrar con el botón dejaría vivo un setTimeout que
    // llamaría a onCerrar sobre un modal que ya no existe.
    const id = setTimeout(() => cerrarRef.current?.(), CIERRE_MS);
    return () => clearTimeout(id);
  }, []);

  const esEntrada = tipo === "entrada";

  return (
    <div className="mc-modal-overlay mc-notify-overlay" role="presentation">
      <div
        className="mc-modal mc-notify-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checada-modal-title"
      >
        <div className="mc-notify-modal-icon mc-notify-modal-icon--ok">
          <Icon name={esEntrada ? "check" : "logout"} size={22} />
        </div>

        {/* aria-live: quien usa lector de pantalla se entera de que ya fichó sin tener que ir a
            buscar el foco, igual que quien lo oye por la voz guía. */}
        <h2 id="checada-modal-title" className="mc-notify-modal-title" aria-live="polite">
          {esEntrada ? "Entrada registrada" : "Salida registrada"}
        </h2>

        <p className="mc-notify-modal-desc">
          Hoy a las <strong>{hora}</strong>.
          {tarde && " Llegaste después de tu hora, queda como retardo."}
          {fuera && " Ojo: quedó registrada fuera de tu clínica."}
          {!tarde && !fuera && !esEntrada && " ¡Buen día!"}
        </p>

        <div className="mc-notify-modal-actions">
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={onCerrar}>
            <Icon name="check" size={16} />
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
