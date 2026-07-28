import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { getAccesoReunion } from "../../services/supabase/reunionesService";

/**
 * Sala de vídeo embebida.
 *
 * Usa el External API de Jitsi, que crea un iframe y deja controlarlo desde aquí. La
 * alternativa —un enlace que abre otra pestaña— sacaría a la gente de Pulse y perdería el
 * contexto de la reunión.
 *
 * El script se carga de meet.mcdentalpulse.duckdns.org SOLO cuando alguien entra a una sala, y
 * no en cada carga de la app: son cientos de kilobytes que no le sirven de nada a quien viene
 * a mirar sus checadas.
 */
const cargarApiJitsi = (dominio) =>
  new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve(window.JitsiMeetExternalAPI);
    const existente = document.querySelector("script[data-jitsi]");
    if (existente) {
      existente.addEventListener("load", () => resolve(window.JitsiMeetExternalAPI));
      existente.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://${dominio}/external_api.js`;
    s.async = true;
    s.dataset.jitsi = "1";
    s.onload = () => resolve(window.JitsiMeetExternalAPI);
    s.onerror = () => reject(new Error("No se pudo cargar el servidor de reuniones."));
    document.head.appendChild(s);
  });

const SalaJitsi = ({ reunion, onSalir }) => {
  const caja = useRef(null);
  const apiRef = useRef(null);

  // onSalir va a un ref y NO a las dependencias del efecto.
  //
  // Esto fue el bug que cortaba las llamadas cada 30-60 segundos. El padre pasa
  // `onSalir={() => setEnSala(null)}`: una función NUEVA en cada render. Al tenerla como
  // dependencia, cualquier repintado del padre —y ahí los hay constantemente: mensajes en
  // tiempo real, presencia, reacciones— limpiaba el efecto, llamaba a dispose() y destruía
  // la videollamada entera para volver a montarla.
  //
  // Desde fuera parecía un problema de red: ICE con timeouts, jicofo expulsando con "reason:
  // gone", el websocket reconectando. Todo eso era la CONSECUENCIA de que React desmontara
  // el iframe, no la causa.
  const salirRef = useRef(onSalir);
  // En su propio efecto: asignar un ref durante el render no esta permitido, y este
  // efecto es independiente del que monta la sala, asi que actualizarlo no la destruye.
  useEffect(() => { salirRef.current = onSalir; }, [onSalir]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;

    const entrar = async () => {
      try {
        // El token viene del servidor, que comprueba que estoy invitado. Aquí no se decide
        // nada: si no tengo derecho, esta llamada falla y no hay sala.
        const acceso = await getAccesoReunion(reunion.id);
        if (!vivo) return;

        const JitsiMeetExternalAPI = await cargarApiJitsi(acceso.dominio);
        if (!vivo || !caja.current) return;

        apiRef.current = new JitsiMeetExternalAPI(acceso.dominio, {
          roomName: acceso.sala,
          jwt: acceso.token,
          parentNode: caja.current,
          configOverwrite: {
            prejoinPageEnabled: true,
            disableDeepLinking: true,
            // Nada de grabar ni retransmitir. Grabar una sesión con la psicóloga es una
            // decisión legal, no un botón que deba estar ahí por defecto.
            fileRecordingsEnabled: false,
            liveStreamingEnabled: false,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
            DEFAULT_BACKGROUND: "#1f2937",
            TOOLBAR_BUTTONS: [
              "microphone", "camera", "desktop", "fullscreen", "hangup",
              "chat", "raisehand", "tileview", "settings", "videoquality",
            ],
          },
        });

        // Colgar dentro de Jitsi tiene que devolver a Pulse: si no, queda una pantalla negra
        // y la sensación de haberse quedado atrapado.
        apiRef.current.addListener("readyToClose", () => salirRef.current());
        apiRef.current.addListener("videoConferenceJoined", () => { if (vivo) setCargando(false); });
        setCargando(false);
      } catch (e) {
        if (vivo) setError(e?.message || "No se pudo entrar a la reunión.");
      }
    };

    entrar();

    return () => {
      vivo = false;
      // Soltar SIEMPRE la cámara y el micrófono al salir. Es el mismo cuidado que en
      // CapturaSelfie: dejar el iframe vivo mantiene la luz de la cámara encendida y la
      // sensación —fundada— de que se sigue grabando.
      try { apiRef.current?.dispose(); } catch { /* ya estaba cerrado */ }
      apiRef.current = null;
    };
  }, [reunion.id]);

  return (
    <div className="reunion-sala">
      <div className="reunion-sala-barra">
        <button type="button" className="reunion-sala-volver" onClick={onSalir}>
          <Icon name="chevronDown" size={16} className="reunion-sala-volver-icono" />
          Volver a Mensajes
        </button>
        <span className="reunion-sala-titulo">{reunion.titulo}</span>
      </div>

      {error ? (
        <div className="reunion-sala-error">
          <Icon name="alert" size={20} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {cargando && <div className="reunion-sala-cargando">Conectando…</div>}
          <div className="reunion-sala-marco" ref={caja} />
        </>
      )}
    </div>
  );
};

export default SalaJitsi;
