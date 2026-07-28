import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import Icon from "../ui/Icon";
import { formatoPeso } from "../../utils/archivo";
import { formatoDuracion } from "../../utils/audio";
import { useGrabadoraVoz } from "../../hooks/useGrabadoraVoz";
import { notify } from "../../utils/notify";

// Tope de crecimiento del textarea. Sin él, pegar un texto largo empuja la conversación
// fuera de la pantalla y deja al usuario escribiendo a ciegas.
const ALTO_MAX = 140;

/**
 * Caja de escritura del chat.
 *
 * Es un textarea y no un input porque el mensaje a la psicóloga rara vez cabe en una línea:
 * con un input, el texto se desplaza lateralmente y no puedes releer lo que llevas escrito.
 * Enter envía y Shift+Enter salta de línea, que es lo que la gente ya tiene en los dedos.
 *
 * El clip abre un menú con dos entradas en vez de un único selector de archivos. La razón es
 * el móvil: un `accept="image/*"` hace que el teléfono ofrezca directamente cámara y galería,
 * mientras que un selector genérico abre el explorador de ficheros, desde donde llegar a una
 * foto son tres pasos más. Elegir "Imagen" o "Documento" antes de abrir nada cambia bastante
 * la experiencia de quien manda una foto desde el teléfono, que es el caso habitual.
 */
const Composer = ({
  valor, onChange, onEnviar, deshabilitado = false, placeholder,
  archivo, onArchivo, subiendo = false,
  respondiendo, onCancelarRespuesta,
}) => {
  const ref = useRef(null);
  const inputImagen = useRef(null);
  const inputDocumento = useRef(null);
  const menuRef = useRef(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Crecer con el contenido: se resetea a 'auto' antes de medir, porque si no scrollHeight
  // conserva el alto anterior y la caja solo sabría crecer, nunca encoger al borrar.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, ALTO_MAX)}px`;
  }, [valor]);

  // Cerrar el menú al pulsar fuera o con Escape, como el resto de desplegables de la app.
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const fuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
    };
    const tecla = (e) => { if (e.key === "Escape") setMenuAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menuAbierto]);

  // Miniatura del archivo elegido. Con useMemo se crea UNA sola URL por archivo, y el efecto
  // la libera al cambiarlo o al desmontar: hacerlo en el render crearía una por repintado y
  // ninguna se liberaría nunca.
  const vistaPrevia = useMemo(
    () => (archivo?.type?.startsWith("image/") ? URL.createObjectURL(archivo) : null),
    [archivo]
  );
  useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia); }, [vistaPrevia]);

  const esAudio = (archivo?.type || "").startsWith("audio/");

  // La nota de voz acaba siendo un adjunto más: así reutiliza todo el camino de subida,
  // permisos y borrado que ya existe, en vez de abrir un segundo circuito en paralelo.
  const notaLista = useCallback((blob, mime) => {
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
    onArchivo(new File([blob], `nota-de-voz-${Date.now()}.${ext}`, { type: mime }));
  }, [onArchivo]);

  const grabadora = useGrabadoraVoz({ onLista: notaLista });

  useEffect(() => {
    if (grabadora.estado === "denegada") {
      notify.toast.error("No diste permiso al micrófono. Puedes activarlo desde los ajustes del navegador.");
    } else if (grabadora.estado === "no_disponible") {
      notify.toast.error("Este navegador no permite grabar notas de voz.");
    }
  }, [grabadora.estado]);

  const alPulsar = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnviar();
    }
  };

  const elegir = (e) => {
    const f = e.target.files?.[0];
    if (f) onArchivo(f);
    // Se limpia el input para que elegir DOS VECES el mismo archivo vuelva a disparar el
    // change: sin esto, quitarlo y volver a ponerlo no hace nada y parece que está roto.
    e.target.value = "";
    setMenuAbierto(false);
  };

  const abrir = (input) => { setMenuAbierto(false); input.current?.click(); };

  // Con un archivo seleccionado el mensaje puede ir sin texto: mandar solo una foto es normal.
  const nadaQueEnviar = !valor.trim() && !archivo;

  // Mientras se graba, la caja entera es la grabación: dejar el textarea al lado invita a
  // escribir a la vez y a perder lo uno o lo otro al enviar.
  if (grabadora.estado === "grabando" || grabadora.estado === "pidiendo") {
    const pidiendo = grabadora.estado === "pidiendo";
    return (
      <div className="chat-composer chat-composer--grabando">
        <div className="chat-grabando">
          <span className="chat-grabando-punto" aria-hidden="true" />
          <span className="chat-grabando-texto">
            {pidiendo ? "Pidiendo permiso al micrófono…" : "Grabando nota de voz"}
          </span>
          {!pidiendo && (
            <span className="chat-grabando-tiempo">
              {formatoDuracion(grabadora.segundos)}
              <small> / {formatoDuracion(grabadora.MAX_SEGUNDOS)}</small>
            </span>
          )}
          <button type="button" className="chat-grabando-cancelar" onClick={grabadora.cancelar}>
            Descartar
          </button>
          <button
            type="button"
            className="chat-composer-enviar"
            onClick={grabadora.terminar}
            disabled={pidiendo}
          >
            <Icon name="check" size={16} />
            <span>Listo</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-composer">
      {respondiendo && (
        <div className="chat-composer-respuesta">
          <Icon name="reply" size={15} />
          <span className="chat-composer-respuesta-datos">
            <span className="chat-composer-respuesta-autor">Respondiendo a {respondiendo.autor}</span>
            <span className="chat-composer-respuesta-texto">{respondiendo.extracto}</span>
          </span>
          <button
            type="button"
            className="chat-composer-adjunto-quitar"
            onClick={onCancelarRespuesta}
            aria-label="Cancelar la respuesta"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {archivo && (
        <div className="chat-composer-adjunto">
          {vistaPrevia
            ? <img className="chat-composer-adjunto-mini" src={vistaPrevia} alt="" />
            : (
              <span className="chat-composer-adjunto-icono">
                <Icon name={esAudio ? "mic" : "paperclip"} size={16} />
              </span>
            )}
          <span className="chat-composer-adjunto-datos">
            {/* El nombre de una nota de voz es un sello de tiempo que no le dice nada a nadie:
                se sustituye por lo que sí importa. */}
            <span className="chat-composer-adjunto-nombre">
              {esAudio ? "Nota de voz lista para enviar" : archivo.name}
            </span>
            <span className="chat-composer-adjunto-peso">{formatoPeso(archivo.size)}</span>
          </span>
          <button
            type="button"
            className="chat-composer-adjunto-quitar"
            onClick={() => onArchivo(null)}
            aria-label="Quitar el archivo"
            disabled={subiendo}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <textarea
        ref={ref}
        className="chat-composer-campo"
        value={valor}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={alPulsar}
        placeholder={placeholder || "Escribe un mensaje…"}
        disabled={deshabilitado}
      />

      <div className="chat-composer-acciones">
        <span className="chat-composer-ayuda">
          <kbd>Enter</kbd> envía · <kbd>Shift</kbd>+<kbd>Enter</kbd> salta línea
        </span>

        <div className="chat-composer-botones">
          <input ref={inputImagen} type="file" accept="image/*" className="chat-composer-file" onChange={elegir} tabIndex={-1} />
          <input ref={inputDocumento} type="file" className="chat-composer-file" onChange={elegir} tabIndex={-1} />

          <div className="chat-composer-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className={`chat-composer-icono${menuAbierto ? " chat-composer-icono--activo" : ""}`}
              onClick={() => setMenuAbierto((v) => !v)}
              disabled={deshabilitado || subiendo}
              aria-label="Adjuntar"
              aria-expanded={menuAbierto}
              aria-haspopup="menu"
              title="Adjuntar (máx. 10 MB)"
            >
              <Icon name="paperclip" size={18} />
            </button>

            <button
              type="button"
              className="chat-composer-icono"
              onClick={grabadora.empezar}
              disabled={deshabilitado || subiendo || !!archivo}
              aria-label="Grabar una nota de voz"
              title={archivo ? "Quita el archivo para grabar una nota" : "Grabar una nota de voz"}
            >
              <Icon name="mic" size={18} />
            </button>

            {menuAbierto && (
              <div className="chat-composer-menu" role="menu">
                <button type="button" role="menuitem" className="chat-composer-menu-item" onClick={() => abrir(inputImagen)}>
                  <Icon name="image" size={16} />
                  <span>
                    Imagen o foto
                    <small>Cámara o galería</small>
                  </span>
                </button>
                <button type="button" role="menuitem" className="chat-composer-menu-item" onClick={() => abrir(inputDocumento)}>
                  <Icon name="file" size={16} />
                  <span>
                    Documento
                    <small>PDF, Word, Excel…</small>
                  </span>
                </button>
                <div className="chat-composer-menu-pie">Hasta 10 MB por archivo</div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="chat-composer-enviar"
            onClick={onEnviar}
            disabled={nadaQueEnviar || deshabilitado}
            aria-label="Enviar mensaje"
          >
            {subiendo ? <span className="chat-composer-girando" /> : <Icon name="send" size={16} />}
            <span>{subiendo ? "Subiendo…" : "Enviar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Composer;
