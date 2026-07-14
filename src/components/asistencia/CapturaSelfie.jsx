import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import Icon from "../ui/Icon";
import { canvasABlob } from "../../utils/imagen";
import { detectarRostro, encuadreBueno, recortarACara, RESULTADO } from "../../utils/rostro";

const ANCHO_SELFIE = 480;
const INTERVALO_MS = 350;   // cada cuánto se mira el vídeo buscando la cara
const FRAMES_ESTABLES = 3;  // cuántas veces seguidas debe estar bien encuadrada

/**
 * Cámara frontal con guía en vivo y disparo automático.
 *
 * getUserMedia y no <input capture="user">: con el input, en muchos Android el usuario puede
 * elegir una foto de la galería y en escritorio es un simple selector de archivos. Una
 * selfie que se puede sacar del carrete no comprueba nada, y una comprobación que no
 * comprueba es peor que ninguna, porque genera confianza falsa.
 *
 * POR QUÉ SE DISPARA SOLA: pedirle a alguien que se encuadre Y pulse un botón, sujetando el
 * teléfono con una mano, a las ocho de la mañana, es pedirle dos cosas a la vez. El
 * resultado son fotos movidas, cortadas o sin cara — que luego el servidor rechaza y acaban
 * en un "no se pudo" que el empleado no sabe cómo arreglar. La cámara ve la cara, le dice
 * qué corregir ("acércate", "centra tu cara") y dispara cuando está bien. El botón sigue
 * ahí por si alguien prefiere pulsarlo.
 *
 * Se exige que el encuadre esté bien VARIOS fotogramas seguidos, no uno: si no, dispararía
 * en mitad de un movimiento y saldría movida.
 */
const CapturaSelfie = forwardRef(function CapturaSelfie({ activa = true, onAutoCaptura = null }, ref) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const establesRef = useRef(0);
  const ocupadoRef = useRef(false);

  const [estado, setEstado] = useState("iniciando"); // iniciando | lista | denegada | no_disponible
  const [guia, setGuia] = useState({ ok: false, pista: "Colócate frente a la cámara." });

  useEffect(() => {
    if (!activa) return undefined;

    let cancelado = false;

    const abrirCamara = async () => {
      // getUserMedia solo existe en contexto seguro (HTTPS o localhost). Abrir la app desde
      // el móvil contra http://192.168.x.x deja mediaDevices en undefined, y sin este guard
      // el componente reventaría con un TypeError en vez de explicarlo.
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
          // Se desmontó mientras el usuario decidía si dar permiso. Sin esto, el stream queda
          // vivo con la luz de la cámara encendida y sin nadie que la apague.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setEstado("lista");
      } catch (error) {
        console.warn("No se pudo abrir la cámara:", error?.name || error);
        setEstado("denegada");
      }
    };

    abrirCamara();

    return () => {
      cancelado = true;
      // Apagar SIEMPRE los tracks al desmontar. Es el bug clásico de este componente: si no
      // se detienen, la luz de la cámara se queda encendida al salir de la pantalla y el
      // usuario cree, con razón, que le están grabando.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [activa]);

  // Conectar el stream al <video> va en su PROPIO efecto, después de que React haya pintado
  // el elemento. Al hacerlo dentro del getUserMedia, el <video> todavía no existía en el DOM
  // y la asignación se perdía EN SILENCIO: permiso concedido, stream abierto, y un
  // rectángulo negro.
  useEffect(() => {
    const video = videoRef.current;
    if (video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
    }
  }, [estado]);

  /** Toma el fotograma actual, comprueba que hay una cara y la recorta. */
  const capturar = useCallback(async () => {
    const video = videoRef.current;
    if (estado !== "lista" || !video?.videoWidth) {
      return { blob: null, resultado: RESULTADO.NO_DISPONIBLE };
    }

    const escala = Math.min(1, ANCHO_SELFIE / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    // Se dibuja el fotograma ORIGINAL, sin el espejo del CSS: el vídeo se ve espejado porque
    // la gente espera verse como en un espejo, pero la foto que se guarda tiene que ser la
    // real, o el cotejo compararía una cara contra su reflejo.
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    const { resultado, box } = await detectarRostro(canvas);

    if (resultado === RESULTADO.SIN_CARA || resultado === RESULTADO.VARIAS_CARAS) {
      return { blob: null, resultado };
    }

    try {
      const salida = box ? recortarACara(canvas, box) : canvas;
      return { blob: await canvasABlob(salida), resultado };
    } catch (error) {
      console.warn("No se pudo capturar la selfie:", error);
      return { blob: null, resultado: RESULTADO.NO_DISPONIBLE };
    }
  }, [estado]);

  // Bucle de guía: mira el vídeo, dice qué corregir y dispara cuando el encuadre aguanta
  // bien varios fotogramas seguidos. Solo si el padre pide auto-captura.
  useEffect(() => {
    if (estado !== "lista" || !onAutoCaptura) return undefined;

    let vivo = true;

    const id = setInterval(async () => {
      const video = videoRef.current;
      if (!vivo || ocupadoRef.current || !video?.videoWidth) return;

      // Una imagen pequeña basta para saber DÓNDE está la cara, y cuesta la décima parte
      // que analizar el fotograma entero cada 350 ms — que en un móvil se nota en la batería
      // y en el calor del aparato.
      const lienzo = document.createElement("canvas");
      lienzo.width = 240;
      lienzo.height = Math.round((video.videoHeight / video.videoWidth) * 240);
      lienzo.getContext("2d").drawImage(video, 0, 0, lienzo.width, lienzo.height);

      const { resultado, box } = await detectarRostro(lienzo);
      if (!vivo) return;

      if (resultado === RESULTADO.VARIAS_CARAS) {
        establesRef.current = 0;
        setGuia({ ok: false, pista: "Hay más de una persona. Debes salir tú solo." });
        return;
      }
      if (resultado !== RESULTADO.OK) {
        establesRef.current = 0;
        setGuia({ ok: false, pista: "No se ve tu cara. Colócate frente a la cámara." });
        return;
      }

      const encuadre = encuadreBueno(box, lienzo.width, lienzo.height);
      setGuia(encuadre);

      if (!encuadre.ok) {
        establesRef.current = 0;
        return;
      }

      establesRef.current += 1;
      if (establesRef.current < FRAMES_ESTABLES) return;

      // Encuadre bueno y estable: se dispara.
      ocupadoRef.current = true;
      establesRef.current = 0;
      try {
        const foto = await capturar();
        if (vivo && foto.blob) onAutoCaptura(foto);
      } finally {
        ocupadoRef.current = false;
      }
    }, INTERVALO_MS);

    return () => { vivo = false; clearInterval(id); };
  }, [estado, onAutoCaptura, capturar]);

  useImperativeHandle(ref, () => ({ capturar, estado }), [capturar, estado]);

  return (
    <div className="checador-camara">
      {/* El <video> se renderiza SIEMPRE, aunque todavía no haya stream: si se montara solo
          al estar "lista", el ref no existiría cuando getUserMedia resuelve y el stream no
          tendría dónde engancharse. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline /* sin esto, iOS abre el vídeo a pantalla completa en vez de en línea */
        className={`checador-camara-video ${estado === "lista" ? "" : "checador-camara-video--oculto"}`}
      />

      {estado === "lista" && onAutoCaptura && (
        <>
          <div className={`checador-guia ${guia.ok ? "checador-guia--ok" : ""}`} aria-hidden="true" />
          <p className={`checador-guia-pista ${guia.ok ? "checador-guia-pista--ok" : ""}`} aria-live="polite">
            {guia.pista}
          </p>
        </>
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
