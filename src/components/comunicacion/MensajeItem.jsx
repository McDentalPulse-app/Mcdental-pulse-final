import { useState } from "react";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import Adjunto from "./Adjunto";
import AudioMensaje from "./AudioMensaje";
import EnlacePreview from "./EnlacePreview";
import { horaCorta } from "../../utils/fechaChat";

/**
 * Emojis disponibles para reaccionar.
 *
 * La lista es corta y deliberada: esto es un canal de apoyo psicológico, no un chat de
 * equipo. Un 😂 o un 🎉 aquí pueden leerse como burla sobre algo que a la otra persona le
 * costó escribir. Las cinco cubren lo que hace falta: apoyo, acuerdo, gratitud, sorpresa
 * y acompañar en lo malo.
 */
const EMOJIS = ["❤️", "👍", "🙏", "😮", "😢"];

const MensajeItem = ({
  mensaje, mio, autor, primero, ultimo,
  citado, reacciones = [], miId,
  onReaccionar, onResponder, onEliminar,
}) => {
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Agrupadas por emoji, con la marca de si yo estoy dentro: es lo que permite pintar el
  // contador y que volver a pulsar retire la mía.
  const agrupadas = reacciones.reduce((acc, r) => {
    const g = (acc[r.emoji] ||= { emoji: r.emoji, total: 0, mia: false });
    g.total += 1;
    if (r.usuarioId === miId) g.mia = true;
    return acc;
  }, {});

  const esImagenSola = mensaje.adjunto && !mensaje.texto
    && (mensaje.adjunto.mime || "").startsWith("image/");

  return (
    <div
      className={[
        "chat-fila",
        mio ? "chat-fila--mia" : "chat-fila--suya",
        primero ? "chat-fila--primera" : "",
        ultimo ? "chat-fila--ultima" : "",
        mensaje.eliminado ? "chat-fila--eliminada" : "",
      ].filter(Boolean).join(" ")}
    >
      {!mio && (
        <div className="chat-fila-avatar">
          {primero && (
            <Avatar name={autor?.name} size={36} photoUrl={autor?.avatarUrl} color="var(--mc-texto-secundario)" />
          )}
        </div>
      )}

      <div className="chat-fila-cuerpo">
        {primero && (
          <div className="chat-meta">
            <span className="chat-meta-nombre">{mio ? "Tú" : autor?.name || "Usuario"}</span>
            <span className="chat-meta-hora">{horaCorta(mensaje.fecha)}</span>
            {mio && !mensaje.eliminado && (
              <Icon
                name={mensaje.leido ? "checkDoble" : "checkSimple"}
                size={14}
                className={`chat-acuse${mensaje.leido ? " chat-acuse--leido" : ""}`}
              />
            )}
          </div>
        )}

        {mensaje.eliminado ? (
          <div className="chat-burbuja chat-burbuja--eliminada">
            <Icon name="trash" size={14} />
            <span>Mensaje eliminado</span>
          </div>
        ) : (
          <div className="chat-mensaje-envoltorio">
            {esImagenSola ? (
              <Adjunto adjunto={mensaje.adjunto} />
            ) : (
              <div className="chat-burbuja">
                {citado && (
                  // La cita repite lo justo para situar: quién y un extracto. Repetir el
                  // mensaje entero convierte el hilo en un eco de sí mismo.
                  <div className="chat-cita">
                    <span className="chat-cita-autor">{citado.autor}</span>
                    <span className="chat-cita-texto">{citado.extracto}</span>
                  </div>
                )}
                {/* Purgado por retención: NO es lo mismo que eliminado por alguien, y la
                    diferencia importa. Sin este aviso, un mensaje al que le falta el archivo
                    parecería que alguien lo borró a propósito. */}
                {mensaje.adjuntoPurgado && (
                  <div className="chat-adjunto chat-adjunto--purgado">
                    <Icon name="clock" size={15} />
                    <span>El archivo se eliminó por antigüedad (90 días).</span>
                  </div>
                )}
                {mensaje.adjunto && (
                  (mensaje.adjunto.mime || "").startsWith("audio/")
                    ? <AudioMensaje adjunto={mensaje.adjunto} />
                    : <Adjunto adjunto={mensaje.adjunto} />
                )}
                {mensaje.texto && <p className="chat-burbuja-texto">{mensaje.texto}</p>}
                {mensaje.enlace && <EnlacePreview enlace={mensaje.enlace} />}
              </div>
            )}

            {/* Acciones al pasar por encima. En táctil no hay hover, así que el CSS las deja
                siempre visibles por debajo de 900px. */}
            <div className="chat-acciones">
              <div className="chat-reaccionar">
                <button
                  type="button"
                  className="chat-accion"
                  onClick={() => setMenuAbierto((v) => !v)}
                  aria-label="Reaccionar"
                  aria-expanded={menuAbierto}
                  title="Reaccionar"
                >
                  <Icon name="smile" size={15} />
                </button>
                {menuAbierto && (
                  <div className="chat-emojis" role="menu">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        role="menuitem"
                        className="chat-emoji"
                        onClick={() => { setMenuAbierto(false); onReaccionar(mensaje.id, e); }}
                        aria-label={`Reaccionar con ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="chat-accion"
                onClick={() => onResponder(mensaje)}
                aria-label="Responder"
                title="Responder"
              >
                <Icon name="reply" size={15} />
              </button>

              {mio && (
                <button
                  type="button"
                  className="chat-accion chat-accion--peligro"
                  onClick={() => onEliminar(mensaje)}
                  aria-label="Eliminar"
                  title="Eliminar para los dos"
                >
                  <Icon name="trash" size={15} />
                </button>
              )}
            </div>
          </div>
        )}

        {Object.values(agrupadas).length > 0 && (
          <div className="chat-reacciones">
            {Object.values(agrupadas).map((g) => (
              <button
                key={g.emoji}
                type="button"
                className={`chat-reaccion${g.mia ? " chat-reaccion--mia" : ""}`}
                onClick={() => onReaccionar(mensaje.id, g.emoji)}
                title={g.mia ? "Quitar mi reacción" : "Reaccionar"}
              >
                <span>{g.emoji}</span>
                {g.total > 1 && <small>{g.total}</small>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MensajeItem;
