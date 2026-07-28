import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import MensajeItem from "./MensajeItem";
import Composer from "./Composer";
import Reuniones from "./Reuniones";
import SalaJitsi from "./SalaJitsi";
import { getPsicologaPrincipal, formatUsuarioMensajesMeta } from "../../utils/psicologa";
import { esEmpleadoActivo } from "../../utils/helpers";
import { horaCorta, claveDia, etiquetaDia, continuaGrupo } from "../../utils/fechaChat";
import {
  getMensajes, subscribeMensajes, canalConversacion, subirAdjunto,
  getReacciones, subscribeReacciones, alternarReaccion, eliminarMensaje,
} from "../../services/supabase/mensajesService";
import { notify } from "../../utils/notify";

// Cuánto de un mensaje se repite en la cita al responder. Lo justo para reconocerlo.
const LARGO_CITA = 90;

// Tras cuánto silencio se considera que dejó de escribir. Ni tan corto que parpadee entre
// palabras, ni tan largo que el indicador siga puesto cuando ya se fue.
const PAUSA_ESCRIBIENDO_MS = 2500;

// Orden cronológico: los ids son uuid (no ordenables), se ordena por fecha (ISO, sortable como string).
const porTiempo = (a, b) => String(a.fecha || "").localeCompare(String(b.fecha || ""));

const Mensajes = ({ user, mensajes, onSend, onMarkRead = () => {} }) => {
  const { usuarios: USERS, setMensajes } = useGlobal();

  const [selectedId, setSelectedId] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [respondiendo, setRespondiendo] = useState(null);
  const [reacciones, setReacciones] = useState({});
  const [otro, setOtro] = useState({ presente: false, escribiendo: false });
  // Admin y RH NO ven las conversaciones. No es un olvido: AdminLayout ya mostraba ahí un
  // "Acceso restringido — este canal es privado y solo está disponible para empleados y
  // psicóloga". Las reuniones son otra cosa y sí les tocan, así que entran por la misma
  // pantalla pero solo con esa pestaña.
  const veChat = ["psicologa", "empleado", "doctor"].includes(user?.role);
  const [pestana, setPestana] = useState(veChat ? "chat" : "reuniones");
  // La sala ocupa la pantalla entera: una videollamada en un recuadro de la esquina no la
  // usa nadie, y compartir pantalla dentro de un panel pequeño no se lee.
  const [enSala, setEnSala] = useState(null);
  // Estable entre renders: pasarla como arrow inline la recreaba en cada repintado.
  const salirDeLaSala = useCallback(() => setEnSala(null), []);
  const bodyRef = useRef(null);
  const canalRef = useRef(null);
  const pausaRef = useRef(null);

  const psicologa = getPsicologaPrincipal(USERS);
  const empleados = USERS.filter(esEmpleadoActivo);
  const getUserById = (id) => USERS.find(u => u.id === id);

  const conversaciones = user.role === "psicologa"
    ? empleados.map(emp => {
        const convMensajes = mensajes
          .filter(m =>
            (m.de === user.id && m.para === emp.id) ||
            (m.de === emp.id && m.para === user.id)
          )
          .sort(porTiempo);
        return {
          usuario: emp,
          mensajes: convMensajes,
          ultimo: convMensajes[convMensajes.length - 1],
          noLeidos: convMensajes.filter(m => m.para === user.id && !m.leido).length,
        };
      })
    : psicologa
      ? [{
          usuario: psicologa,
          mensajes: [...mensajes].sort(porTiempo),
          ultimo: [...mensajes].sort(porTiempo).slice(-1)[0],
          noLeidos: mensajes.filter(m => m.para === user.id && !m.leido).length,
        }]
      : [];

  const conversacionesActivas = user.role === "psicologa"
    ? conversaciones
        .filter(c => c.mensajes.length > 0)
        .sort((a, b) => String(b.ultimo?.fecha || "").localeCompare(String(a.ultimo?.fecha || "")))
    : conversaciones;

  const selected =
    conversacionesActivas.find(c => c.usuario.id === selectedId) ||
    conversacionesActivas[0] ||
    null;

  const mensajesChat = selected?.mensajes || [];

  // Al abrir/actualizar una conversación: marcar recibidos como leídos + bajar al final.
  useEffect(() => {
    if (!selected) return;
    const pendientes = selected.mensajes.filter(m => m.para === user.id && !m.leido);
    if (pendientes.length) onMarkRead(pendientes);
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [selected?.usuario.id, selected?.mensajes.length]);

  // Realtime: un mensaje nuevo, o un `leido` que cambia, refrescan la lista sin recargar.
  // Se vuelve a consultar en vez de insertar el payload a mano: el volumen es mínimo y así no
  // hay dos caminos por los que un mensaje puede entrar en el estado.
  useEffect(() => {
    if (!user?.id) return undefined;
    return subscribeMensajes(user.id, () => {
      getMensajes().then(setMensajes).catch(() => {});
    });
  }, [user?.id, setMensajes]);

  // Reacciones de la conversación abierta, y su realtime. Van en una consulta aparte y no en
  // el join de mensajes porque cambian mucho más a menudo que los mensajes: una reacción no
  // debe obligar a recargar toda la conversación.
  useEffect(() => {
    const ids = mensajesChat.map((m) => m.id);
    if (!ids.length) return undefined;
    let vivo = true;
    const recargar = () => { getReacciones(ids).then((r) => { if (vivo) setReacciones(r); }); };
    recargar();
    const desuscribir = subscribeReacciones(user?.id, recargar);
    return () => { vivo = false; desuscribir(); };
  }, [selected?.usuario.id, mensajesChat.length, user?.id]);

  const reaccionar = async (mensajeId, emoji) => {
    const puesta = (reacciones[mensajeId] || []).some(
      (r) => r.emoji === emoji && r.usuarioId === user.id
    );
    try {
      await alternarReaccion({ mensajeId, usuarioId: user.id, emoji, puesta });
      setReacciones(await getReacciones(mensajesChat.map((m) => m.id)));
    } catch (e) {
      notify.toast.error(e?.message || "No se pudo reaccionar.");
    }
  };

  const borrar = async (mensaje) => {
    const ok = await notify.confirm({
      title: "Eliminar el mensaje",
      description: "Desaparecerá también para la otra persona. Quedará la marca de que lo eliminaste.",
      variant: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    try {
      await eliminarMensaje(mensaje.id);
      setMensajes(await getMensajes());
    } catch (e) {
      notify.toast.error(e?.message || "No se pudo eliminar el mensaje.");
    }
  };

  // Presencia y "escribiendo…" de la conversación abierta. Se rehace al cambiar de
  // conversación: el canal es por pareja, no por usuario.
  useEffect(() => {
    if (!selected?.usuario.id || !user?.id) return undefined;

    const canal = canalConversacion({
      yo: user.id,
      otro: selected.usuario.id,
      onPresencia: setOtro,
    });
    canalRef.current = canal;

    return () => {
      clearTimeout(pausaRef.current);
      canalRef.current = null;
      canal.cerrar();
      // La presencia de la conversación que se cierra no vale para la siguiente. Se limpia
      // aquí y no al entrar, para no llamar a setState en el cuerpo del efecto.
      setOtro({ presente: false, escribiendo: false });
    };
  }, [selected?.usuario.id, user?.id]);

  // Avisar de que estoy escribiendo, y dejar de avisar tras una pausa. El temporizador se
  // reinicia con cada tecla, así que el aviso se apaga solo cuando de verdad se para.
  const alEscribir = (valor) => {
    setTexto(valor);
    if (!canalRef.current) return;
    canalRef.current.setEscribiendo(valor.trim().length > 0);
    clearTimeout(pausaRef.current);
    pausaRef.current = setTimeout(
      () => canalRef.current?.setEscribiendo(false),
      PAUSA_ESCRIBIENDO_MS
    );
  };

  const enviar = async () => {
    if (!selected || enviando) return;
    if (!texto.trim() && !archivo) return;
    setEnviando(true);
    try {
      // El archivo sube PRIMERO y el mensaje se inserta después con su ruta. Si la subida
      // falla, no llega a crearse un mensaje que apunte a un archivo que no existe — que es
      // justo lo que deja una burbuja rota para siempre.
      let adjunto = null;
      if (archivo) {
        adjunto = await subirAdjunto({ miId: user.id, archivo });
      }

      const ok = await onSend({
        de: user.id,
        para: selected.usuario.id,
        texto: texto.trim(),
        adjunto,
        respondeA: respondiendo?.id || null,
        fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
        leido: false,
      });
      if (ok) {
        setTexto("");
        setArchivo(null);
        setRespondiendo(null);
        // El indicador se apaga en cuanto sale el mensaje: dejarlo puesto hasta que venza la
        // pausa haría creer que sigue escribiendo algo más.
        clearTimeout(pausaRef.current);
        canalRef.current?.setEscribiendo(false);
      }
    } catch (e) {
      // Sobre todo por la subida: si el archivo pasa de 10 MB o el storage lo rechaza, sin
      // esto no ocurriría nada visible y parecería que el botón no funciona. Se conserva lo
      // escrito y el archivo elegido, para poder reintentar sin volver a empezar.
      notify.toast.error(e?.message || "No se pudo enviar el mensaje.");
    } finally {
      // Se libera pase lo que pase: si el envío falla y el botón se queda bloqueado, el
      // usuario ve su mensaje escrito y sin forma de reintentarlo.
      setEnviando(false);
    }
  };

  /**
   * Datos de la cita de un mensaje al que se respondió.
   *
   * Se resuelve aquí y no en la burbuja porque solo este componente tiene la conversación
   * entera: la burbuja no puede ir a buscar un mensaje que no le han pasado. Devuelve null si
   * el citado ya no está —fue eliminado, o `on delete set null` lo dejó huérfano— y entonces
   * la respuesta se pinta sin cita, que sigue teniendo sentido por sí sola.
   */
  const citaDe = (id) => {
    if (!id) return null;
    const orig = mensajesChat.find((m) => m.id === id);
    if (!orig) return null;
    const autor = orig.de === user.id ? "Tú" : getUserById(orig.de)?.name || "Usuario";
    const extracto = orig.eliminado
      ? "Mensaje eliminado"
      : orig.texto
        ? orig.texto.slice(0, LARGO_CITA) + (orig.texto.length > LARGO_CITA ? "…" : "")
        : orig.adjunto?.nombre || "Adjunto";
    return { autor, extracto };
  };

  const sinConversacionesActivas = conversacionesActivas.length === 0;

  if (enSala) return <SalaJitsi reunion={enSala} onSalir={salirDeLaSala} />;

  return (
    <div className="admin-page mensajes-page">
      <PageHeader
        className="mensajes-page-header"
        icon="message"
        title="Mensajes"
        subtitle={veChat
          ? "Canal privado de comunicación entre empleado y psicóloga."
          : "Convoca reuniones por vídeo con el personal."}
      />

      <div className="mensajes-pestanas" role="tablist">
        {veChat && (
          <button
            type="button" role="tab" aria-selected={pestana === "chat"}
            className={`mensajes-pestana${pestana === "chat" ? " mensajes-pestana--activa" : ""}`}
            onClick={() => setPestana("chat")}
          >
            <Icon name="message" size={16} /> Conversaciones
          </button>
        )}
        <button
          type="button" role="tab" aria-selected={pestana === "reuniones"}
          className={`mensajes-pestana${pestana === "reuniones" ? " mensajes-pestana--activa" : ""}`}
          onClick={() => setPestana("reuniones")}
        >
          <Icon name="camera" size={16} /> Reuniones
        </button>
      </div>

      {pestana === "reuniones" || !veChat ? (
        <Reuniones user={user} onEntrar={setEnSala} />
      ) : sinConversacionesActivas ? (
        <Card className="mensajes-inbox-empty-card">
          <div className="mensajes-inbox-empty-icon">
            <Icon name="message" size={28} />
          </div>
          <h2 className="mensajes-inbox-empty-title">No hay conversaciones activas todavía.</h2>
          <p className="mensajes-inbox-empty-text">
            Cuando un empleado envíe un mensaje, aparecerá aquí.
          </p>
        </Card>
      ) : (
        <div className={`mensajes-layout${conversacionesActivas.length === 1 ? " mensajes-layout--single" : ""}`}>
          <Card className="mensajes-sidebar-card">
            <div className="mensajes-sidebar-head">
              <span className="mensajes-sidebar-head-main">
                <Icon name="lock" size={16} />
                Conversaciones privadas
              </span>
              <span className="mensajes-active-badge">
                {conversacionesActivas.length} activa{conversacionesActivas.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mensajes-conv-list">
              {conversacionesActivas.map(c => {
                const activo = selected?.usuario.id === c.usuario.id;
                const badgeCount = activo ? 0 : c.noLeidos;
                const preview = c.ultimo
                  ? `${c.ultimo.de === user.id ? "Tú: " : ""}${c.ultimo.texto}`
                  : "";

                return (
                  <button
                    key={c.usuario.id}
                    type="button"
                    className={`mensajes-conv-item${activo ? " mensajes-conv-item--active" : ""}`}
                    onClick={() => setSelectedId(c.usuario.id)}
                  >
                    <Avatar
                      name={c.usuario.name}
                      size={36}
                      color={activo ? "var(--mc-verde)" : "var(--mc-texto-secundario)"}
                      photoUrl={c.usuario.avatarUrl}
                    />

                    <div className="mensajes-conv-main">
                      <div className="mensajes-conv-name">{c.usuario.name}</div>
                      <div className="mensajes-conv-meta">
                        {preview || formatUsuarioMensajesMeta(c.usuario)}
                      </div>
                    </div>

                    <div className="mensajes-conv-side">
                      {c.ultimo && <span className="mensajes-conv-time">{horaCorta(c.ultimo.fecha)}</span>}
                      {badgeCount > 0 && (
                        <span className="mensajes-conv-badge mensajes-conv-badge--unread" title={`${badgeCount} no leídos`}>
                          {badgeCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="mensajes-chat-card">
            {!selected ? (
              <div className="mensajes-chat-empty">
                <Icon name="message" size={24} />
                <span>Selecciona una conversación para comenzar.</span>
              </div>
            ) : (
              <>
                <div className="mensajes-chat-head">
                  <Avatar
                    name={selected.usuario.name}
                    size={40}
                    color="var(--mc-verde)"
                    photoUrl={selected.usuario.avatarUrl}
                    presente={otro.presente}
                  />
                  <div>
                    <div className="mensajes-chat-name">{selected.usuario.name}</div>
                    <div className="mensajes-chat-meta">
                      {otro.escribiendo
                        ? "escribiendo…"
                        : otro.presente
                          ? "En la conversación"
                          : formatUsuarioMensajesMeta(selected.usuario)}
                    </div>
                  </div>
                  <span className="mensajes-private-pill">
                    <Icon name="lock" size={12} /> Privado
                  </span>
                </div>

                <div className="mensajes-chat-body" ref={bodyRef}>
                  {mensajesChat.length === 0 ? (
                    <div className="mensajes-chat-body-empty">
                      No hay mensajes todavía. Inicia la conversación.
                    </div>
                  ) : mensajesChat.map((m, i) => {
                    const anterior = mensajesChat[i - 1];
                    const siguiente = mensajesChat[i + 1];
                    const primero = !continuaGrupo(m, anterior);
                    const ultimo = !siguiente || !continuaGrupo(siguiente, m);
                    // El corte se decide comparando el DÍA, no la fecha completa: dos mensajes
                    // de la misma jornada a horas distintas no llevan separador.
                    const cambiaDia = !anterior || claveDia(anterior.fecha) !== claveDia(m.fecha);

                    return (
                      <Fragment key={m.id}>
                        {cambiaDia && (
                          <div className="chat-separador-dia">
                            <span>{etiquetaDia(m.fecha)}</span>
                          </div>
                        )}
                        <MensajeItem
                          mensaje={m}
                          mio={m.de === user.id}
                          autor={getUserById(m.de)}
                          primero={primero}
                          ultimo={ultimo}
                          citado={citaDe(m.respondeA)}
                          reacciones={reacciones[m.id]}
                          miId={user.id}
                          onReaccionar={reaccionar}
                          onResponder={setRespondiendo}
                          onEliminar={borrar}
                        />
                      </Fragment>
                    );
                  })}

                  {otro.escribiendo && (
                    <div className="chat-escribiendo" aria-live="polite">
                      <Avatar name={selected.usuario.name} size={28} photoUrl={selected.usuario.avatarUrl} />
                      <span className="chat-escribiendo-puntos" aria-label={`${selected.usuario.name} está escribiendo`}>
                        <i /><i /><i />
                      </span>
                    </div>
                  )}
                </div>

                <Composer
                  valor={texto}
                  onChange={alEscribir}
                  onEnviar={enviar}
                  deshabilitado={enviando}
                  archivo={archivo}
                  onArchivo={setArchivo}
                  subiendo={enviando && !!archivo}
                  respondiendo={respondiendo ? citaDe(respondiendo.id) : null}
                  onCancelarRespuesta={() => setRespondiendo(null)}
                  placeholder="Escribe un mensaje privado…"
                />
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default Mensajes;
