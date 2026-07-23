import { useEffect, useRef, useState, useCallback } from "react";
import Icon from "../ui/Icon";
import { canvasABlob } from "../../utils/imagen";
import { cargarEscaner, detectarEsquinas, recortarRecibo } from "../../utils/scanner";

/**
 * Cámara para fotografiar un recibo DESDE la app, con ESCÁNER: detecta los bordes del recibo en
 * vivo (marco naranja sobre la cámara) y, al capturar, lo recorta y endereza (corrige la
 * perspectiva) antes de mandarlo — como un escáner de documentos.
 *
 * Usa la cámara TRASERA y alta resolución (el texto debe quedar legible). El escáner (OpenCV.js
 * + jscanify) se carga PEREZOSAMENTE aquí, no en el arranque de la app. Si OpenCV no carga (red,
 * navegador viejo), degrada con elegancia: se puede tomar la foto completa sin recorte.
 */
const ANCHO_MAX = 1600;   // resolución de captura (legible sin subir megas de más)
const ANCHO_DETECCION = 480; // resolución a la que se detecta en vivo (rápido)
const INTERVALO_MS = 180;

const CapturaRecibo = ({ onFoto }) => {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const escanerRef = useRef(null);
  const trabajoRef = useRef(null);   // canvas reutilizable para detección en vivo
  const esquinasRef = useRef(null);  // últimas esquinas detectadas, en coords NATIVAS del vídeo

  const [estado, setEstado] = useState("iniciando"); // iniciando | lista | denegada | no_disponible
  const [escanerListo, setEscanerListo] = useState(false);
  const [detectado, setDetectado] = useState(false);
  const [preview, setPreview] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [reabrir, setReabrir] = useState(0);

  const apagar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Carga perezosa del escáner (una vez). Si falla, se sigue sin recorte automático.
  useEffect(() => {
    let vivo = true;
    cargarEscaner()
      .then((e) => { if (vivo) { escanerRef.current = e; setEscanerListo(true); } })
      .catch((err) => { console.warn("Escáner no disponible, captura sin recorte:", err); });
    return () => { vivo = false; };
  }, []);

  // Abre la cámara mientras no haya foto tomada.
  useEffect(() => {
    if (preview) return undefined;
    let cancelado = false;

    const abrir = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setEstado("no_disponible"); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        setEstado("lista");
      } catch (error) {
        console.warn("No se pudo abrir la cámara:", error?.name || error);
        setEstado("denegada");
      }
    };

    abrir();
    return () => { cancelado = true; apagar(); };
  }, [preview, reabrir, apagar]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
    }
  }, [estado]);

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  // Bucle de detección en vivo: mira el vídeo a baja resolución, detecta el recibo y dibuja el
  // marco en la capa de overlay (misma resolución nativa que el vídeo → alineado con object-fit).
  useEffect(() => {
    if (estado !== "lista" || !escanerListo || preview) return undefined;
    let vivo = true;

    const id = setInterval(() => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!vivo || !video?.videoWidth || !overlay) return;

      const vw = video.videoWidth, vh = video.videoHeight;
      if (overlay.width !== vw || overlay.height !== vh) { overlay.width = vw; overlay.height = vh; }

      // Fotograma reducido para detectar rápido.
      const escala = Math.min(1, ANCHO_DETECCION / vw);
      const trabajo = trabajoRef.current || (trabajoRef.current = document.createElement("canvas"));
      trabajo.width = Math.round(vw * escala);
      trabajo.height = Math.round(vh * escala);
      trabajo.getContext("2d").drawImage(video, 0, 0, trabajo.width, trabajo.height);

      const esquinas = detectarEsquinas(escanerRef.current, trabajo);
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, vw, vh);

      if (esquinas) {
        // Pasa las esquinas a coords NATIVAS del vídeo y las guarda: la captura recortará con
        // ESTAS mismas esquinas (lo que ves es lo que se recorta), no con una re-detección.
        const k = 1 / escala;
        const nat = (c) => ({ x: c.x * k, y: c.y * k });
        const nativas = {
          topLeftCorner: nat(esquinas.topLeftCorner),
          topRightCorner: nat(esquinas.topRightCorner),
          bottomRightCorner: nat(esquinas.bottomRightCorner),
          bottomLeftCorner: nat(esquinas.bottomLeftCorner),
        };
        esquinasRef.current = nativas;

        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = Math.max(3, vw * 0.006);
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(nativas.topLeftCorner.x, nativas.topLeftCorner.y);
        ctx.lineTo(nativas.topRightCorner.x, nativas.topRightCorner.y);
        ctx.lineTo(nativas.bottomRightCorner.x, nativas.bottomRightCorner.y);
        ctx.lineTo(nativas.bottomLeftCorner.x, nativas.bottomLeftCorner.y);
        ctx.closePath();
        ctx.stroke();
        setDetectado(true);
      } else {
        esquinasRef.current = null;
        setDetectado(false);
      }
    }, INTERVALO_MS);

    return () => { vivo = false; clearInterval(id); };
  }, [estado, escanerListo, preview]);

  const tomar = async () => {
    const video = videoRef.current;
    if (estado !== "lista" || !video?.videoWidth || procesando) return;
    setProcesando(true);

    try {
      // Fotograma a resolución de captura.
      const escala = Math.min(1, ANCHO_MAX / video.videoWidth);
      const captura = document.createElement("canvas");
      captura.width = Math.round(video.videoWidth * escala);
      captura.height = Math.round(video.videoHeight * escala);
      captura.getContext("2d").drawImage(video, 0, 0, captura.width, captura.height);

      let final = captura;
      if (escanerRef.current) {
        // Preferir las esquinas del marco en vivo (coords nativas → escaladas a la captura):
        // así se recorta EXACTAMENTE lo que se veía marcado. La re-detección es solo respaldo
        // si aún no había marco.
        let esquinas = null;
        const nat = esquinasRef.current;
        if (nat) {
          const e = (c) => ({ x: c.x * escala, y: c.y * escala });
          esquinas = {
            topLeftCorner: e(nat.topLeftCorner),
            topRightCorner: e(nat.topRightCorner),
            bottomRightCorner: e(nat.bottomRightCorner),
            bottomLeftCorner: e(nat.bottomLeftCorner),
          };
        } else {
          esquinas = detectarEsquinas(escanerRef.current, captura);
        }
        const recortado = esquinas && recortarRecibo(escanerRef.current, captura, esquinas);
        if (recortado) final = recortado;
      }

      const blob = await canvasABlob(final);
      apagar();
      setPreview({ url: URL.createObjectURL(blob), recortado: final !== captura });
      onFoto(blob);
    } catch (error) {
      console.warn("No se pudo capturar la foto:", error);
    } finally {
      setProcesando(false);
    }
  };

  const repetir = () => {
    setPreview(null);
    onFoto(null);
    setDetectado(false);
    setEstado("iniciando");
    setReabrir((n) => n + 1);
  };

  if (preview) {
    return (
      <div className="recibo-captura">
        <div className="checador-camara">
          <img src={preview.url} alt="Recibo capturado" className="recibo-captura-preview" />
        </div>
        <span className="recibo-captura-nota">
          {preview.recortado ? "✓ Recibo detectado y recortado" : "Foto completa (no se detectó el borde)"}
        </span>
        <button type="button" className="mc-btn-secondary" onClick={repetir}>
          <Icon name="camera" size={15} /> Repetir foto
        </button>
      </div>
    );
  }

  return (
    <div className="recibo-captura">
      <div className="checador-camara">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`checador-camara-video ${estado === "lista" ? "" : "checador-camara-video--oculto"}`}
        />
        <canvas ref={overlayRef} className="recibo-captura-overlay" aria-hidden="true" />

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
            <span>Actívalo en el navegador para poder fotografiar el recibo.</span>
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

      {estado === "lista" && (
        <p className={`recibo-captura-guia ${detectado ? "recibo-captura-guia--ok" : ""}`} aria-live="polite">
          {!escanerListo
            ? "Preparando el escáner…"
            : detectado
              ? "Recibo detectado. Toma la foto."
              : "Encuadra el recibo dentro del marco."}
        </p>
      )}

      <button type="button" className="mc-btn-primary" onClick={tomar} disabled={estado !== "lista" || procesando}>
        <Icon name="camera" size={15} /> {procesando ? "Procesando…" : "Tomar foto"}
      </button>
    </div>
  );
};

export default CapturaRecibo;
