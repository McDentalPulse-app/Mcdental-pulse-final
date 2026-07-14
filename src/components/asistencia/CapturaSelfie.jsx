import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import Icon from "../ui/Icon";
import { canvasABlob } from "../../utils/imagen";

const ANCHO_SELFIE = 480;

/**
 * Cámara frontal en vivo para la selfie del checador.
 *
 * getUserMedia y no <input capture="user">: con el input, en muchos Android el usuario
 * puede elegir una foto de la galería, y en escritorio es simplemente un selector de
 * archivos. Una selfie que se puede sacar del carrete no comprueba nada, y una
 * comprobación que no comprueba es peor que ninguna, porque genera confianza falsa.
 *
 * Expone capturar() por ref: el padre decide CUÁNDO se toma la foto (al pulsar el botón
 * de checar), y este componente solo sabe CÓMO tomarla.
 */
const CapturaSelfie = forwardRef(function CapturaSelfie({ activa = true }, ref) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [estado, setEstado] = useState("iniciando"); // iniciando | lista | denegada | no_disponible

  useEffect(() => {
    if (!activa) return undefined;

    let cancelado = false;

    const abrirCamara = async () => {
      // getUserMedia solo existe en contexto seguro (HTTPS o localhost). Abrir la app
      // desde el móvil contra http://192.168.x.x deja mediaDevices en undefined, y sin
      // este guard el componente reventaría con un TypeError en vez de explicarlo.
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado("no_disponible");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 } },
          audio: false,
        });

        if (cancelado) {
          // El componente se desmontó mientras el usuario decidía si dar permiso. Sin
          // esto, el stream queda vivo con la luz de la cámara encendida y sin nadie
          // que la apague.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setEstado("lista");
      } catch (error) {
        console.warn("No se pudo abrir la cámara:", error?.name || error);
        setEstado("denegada");
      }
    };

    abrirCamara();

    return () => {
      cancelado = true;
      // Apagar SIEMPRE los tracks al desmontar. Es el bug clásico de este componente: si
      // no se detienen, la luz de la cámara se queda encendida al salir de la pantalla y
      // el usuario cree, con razón, que le están grabando.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [activa]);

  useImperativeHandle(ref, () => ({
    /** Devuelve un Blob JPEG del fotograma actual, o null si la cámara no está lista. */
    capturar: async () => {
      const video = videoRef.current;
      if (estado !== "lista" || !video?.videoWidth) return null;

      const escala = Math.min(1, ANCHO_SELFIE / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * escala);
      canvas.height = Math.round(video.videoHeight * escala);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        return await canvasABlob(canvas);
      } catch (error) {
        console.warn("No se pudo capturar la selfie:", error);
        return null;
      }
    },
    estado,
  }), [estado]);

  return (
    <div className="checador-camara">
      {estado === "lista" && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline /* sin esto, iOS abre el vídeo a pantalla completa en vez de en línea */
          className="checador-camara-video"
        />
      )}

      {estado === "iniciando" && (
        <div className="checador-camara-aviso">
          <Icon name="camera" size={28} />
          <p>Abriendo la cámara…</p>
        </div>
      )}

      {estado === "denegada" && (
        <div className="checador-camara-aviso checador-camara-aviso--alerta">
          <Icon name="camera" size={28} />
          <p>No diste permiso para la cámara.</p>
          <span>Puedes checar igual, pero tu checada quedará sin foto.</span>
        </div>
      )}

      {estado === "no_disponible" && (
        <div className="checador-camara-aviso checador-camara-aviso--alerta">
          <Icon name="camera" size={28} />
          <p>La cámara no está disponible aquí.</p>
          <span>Abre McDental Pulse desde el enlace seguro (https) para usarla.</span>
        </div>
      )}
    </div>
  );
});

export default CapturaSelfie;
