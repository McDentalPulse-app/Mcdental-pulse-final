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

/**
 * Una línea que resuma el último mensaje, para la lista de conversaciones.
 *
 * `texto` puede venir vacío desde la migración 086: un mensaje puede ser SOLO una foto, un audio
 * o un documento. Sin esto, la lista interpolaba el null y pintaba la palabra "null" debajo del
 * nombre — visto en producción el 2026-07-29.
 */
const resumenDe = (m) => {
  if (!m) return "";
  if (m.eliminado) return "Mensaje eliminado";
  if (m.texto) return m.texto;
  const mime = m.adjunto?.mime || "";
  if (mime.startsWith("image/")) return "Imagen";
  if (mime.startsWith("audio/")) return "Nota de voz";
  return m.adjunto?.nombre || "Adjunto";
};

// Interlocutor del canal de Soporte TI visto por el empleado. Para él, Soporte TI es un CANAL y no
// una persona (detrás hay dos), pero la lista y la cabecera esperan un usuario: dándole esta forma
// no hacen falta dos caminos distintos para pintar lo mismo. El id no existe en la base a
// propósito — nunca se usa como destinatario, solo para saber qué conversación está abierta.
const CANAL_SOPORTE = {
  id: "canal-soporte-ti",
  name: "Soporte TI",
  puesto: "Sistemas",
  sucursal: "McDental",
};

const Mensajes = ({ user, mensajes, onSend, onMarkRead = () => {} }) => {
  const { usuarios: USERS, setMensajes } = useGlobal();

  const [selectedId, setSelectedId] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [respondiendo, setRespondiendo] = useState(null);
  const [reacciones, setReacciones] = useState({});
  const [otro, setOtro] = useState({ presente: false, escribiendo: false });
  // Todos los roles ven el chat. Admin y RH estaban fuera porque la única conversación que
  // había era la confidencial con la psicóloga; con el canal de Soporte TI (mig. 094) ya hay
  // algo que sí les toca, y eran los únicos del organigrama que no podían reportar una falla
  // de TI por aquí. Lo que ven está acotado abajo, en `soloSoporte`.
  const veChat = true;
  // Admin y RH: SOLO el buzón de Soporte TI. La conversación con la psicóloga sigue siendo
  // del empleado y de ella. Esto es la mitad de la garantía; la otra mitad — la que de verdad
  // cuenta — vive en la policy mensajes_select_participant, que no deja leer un mensaje a
  // quien no lo escribió ni lo recibió.
  const soloSoporte = ["admin", "rh"].includes(user?.role);
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

  // Quien ATIENDE Soporte TI se distingue por una bandera propia y no por su rol: los dos
  // encargados son rol `empleado` (ver migración 094). Por eso aquí se mira `soporteTi`.
  const atiendeSoporte = !!user?.soporteTi;
  const esDeSoporte = (m) => m.canal === "soporte";

  /**
   * Da forma de conversación a una lista de mensajes.
   *
   * `para` es a quién se le escribe al pulsar enviar, y es lo único que distingue de verdad a los
   * tres casos: la psicóloga (una persona), el buzón de soporte visto por el empleado (nadie: el
   * canal no es una persona, va `null`) y un hilo de soporte visto por quien lo atiende (el
   * empleado del hilo).
   */
  const armarConversacion = ({ usuario, canal, para, mensajes: lista }) => {
    const orden = [...lista].sort(porTiempo);
    return {
      usuario, canal, para,
      mensajes: orden,
      ultimo: orden[orden.length - 1],
      // "No leído" = no lo escribí yo y viene dirigido a mí o al buzón compartido (`para` nulo).
      // La segunda mitad es la que hace que el buzón cuente lo que nadie ha atendido todavía.
      noLeidos: orden.filter(
        (m) => !m.leido && m.de !== user.id && (m.para === user.id || !m.para)
      ).length,
    };
  };

  // El canal de la psicóloga excluye explícitamente lo de soporte: si no, los dos hilos
  // aparecerían mezclados en la conversación privada, que es el peor sitio donde podría pasar.
  const conversacionCon = (otro) =>
    armarConversacion({
      usuario: otro,
      canal: "psicologa",
      para: otro.id,
      mensajes: mensajes.filter(
        (m) => !esDeSoporte(m) &&
          ((m.de === user.id && m.para === otro.id) || (m.de === otro.id && m.para === user.id))
      ),
    });

  // Un hilo por empleado que haya escrito al buzón. El empleado del hilo es quien NO es soporte:
  // en el mensaje que entra no hay destinatario (`para` nulo) y lo escribió él; en la respuesta
  // el destinatario es él.
  const hilosDeSoporte = () => {
    const porEmpleado = new Map();
    for (const m of mensajes.filter(esDeSoporte)) {
      const empId = m.para || m.de;
      if (!porEmpleado.has(empId)) porEmpleado.set(empId, []);
      porEmpleado.get(empId).push(m);
    }
    return [...porEmpleado.entries()].map(([empId, lista]) =>
      armarConversacion({
        usuario: getUserById(empId) || { id: empId, name: "Empleado" },
        canal: "soporte",
        para: empId,
        mensajes: lista,
      })
    );
  };

  const conversaciones = user.role === "psicologa"
    ? empleados.map(conversacionCon)
    : [
        // Admin y RH no llevan la conversación de la psicóloga: para ellos esta pantalla es
        // solo el buzón de Soporte TI.
        ...(psicologa && !soloSoporte ? [conversacionCon(psicologa)] : []),
        // Debajo del chat de la psicóloga, el canal de Soporte TI. Quien lo atiende no se escribe
        // a sí mismo: en su lugar ve los hilos de la plantilla.
        ...(atiendeSoporte
          ? hilosDeSoporte()
          : [armarConversacion({
              usuario: CANAL_SOPORTE,
              canal: "soporte",
              para: null,
              mensajes: mensajes.filter(esDeSoporte),
            })]),
      ];

  // Más reciente primero. Solo se aplica a las listas de muchas conversaciones (la psicóloga y el
  // buzón): las dos fijas de un empleado tienen un orden pensado —psicóloga y debajo soporte— que
  // no debe cambiar según quién escribió último.
  const masRecientePrimero = (a, b) =>
    String(b.ultimo?.fecha || "").localeCompare(String(a.ultimo?.fecha || ""));

  const conversacionesActivas = user.role === "psicologa"
    ? conversaciones.filter(c => c.mensajes.length > 0).sort(masRecientePrimero)
    : atiendeSoporte
      ? [
          // Su propia conversación con la psicóloga va primero y se conserva aunque esté vacía:
          // es la suya, no un hilo que atiende. Debajo, los hilos del buzón por recencia.
          ...conversaciones.filter(c => c.canal === "psicologa"),
          ...conversaciones.filter(c => c.canal === "soporte" && c.mensajes.length > 0).sort(masRecientePrimero),
        ]
      : conversaciones;

  const selected =
    conversacionesActivas.find(c => c.usuario.id === selectedId) ||
    conversacionesActivas[0] ||
    null;

  const mensajesChat = selected?.mensajes || [];

  /**
   * Marca el <body> mientras esta pantalla está montada.
   *
   * El CSS necesita saber "estamos en el chat" para que el armazón deje de desplazarse y solo se
   * muevan los mensajes. Se hacía con `.app-main:has(.mensajes-page)`, y ahí estaba el fallo:
   * `:has()` no existe en iOS Safari anterior a 15.4 ni en Chrome de Android anterior al 105,
   * y un selector que el navegador no entiende NO falla a medias — descarta la regla entera y
   * en silencio. En esos teléfonos volvía el scroll gigante y no había forma de saber por qué.
   *
   * Una clase puesta desde JavaScript funciona en todos.
   */
  useEffect(() => {
    document.body.classList.add("mc-en-chat");
    return () => document.body.classList.remove("mc-en-chat");
  }, []);

  // Y otra para "hay una conversación abierta", que es la que retira la cabecera y las pestañas
  // para dejarle la pantalla entera al chat. Mismo motivo: no depender de `:has()`.
  useEffect(() => {
    document.body.classList.toggle("mc-en-chat-detalle", !!selectedId);
    return () => document.body.classList.remove("mc-en-chat-detalle");
  }, [selectedId]);

  // Al abrir/actualizar una conversación: marcar recibidos como leídos + bajar al final.
  //
  // LA CONDICIÓN TIENE QUE SER LA MISMA QUE LA DEL CONTADOR (ver `noLeidos` arriba), y no lo era.
  // El contador incluye los mensajes de CANAL —`para` nulo, que es como un empleado escribe al
  // buzón de Soporte TI— pero aquí solo se marcaban los dirigidos a una persona concreta. O sea
  // que el badge de Soporte contaba mensajes que ninguna lectura podía limpiar: se quedaba
  // encendido para siempre aunque el hilo estuviera leído. Medido en producción: dos mensajes de
  // canal sin leer desde hacía días, ya atendidos.
  useEffect(() => {
    if (!selected) return;
    const pendientes = selected.mensajes.filter(
      (m) => !m.leido && m.de !== user.id && (m.para === user.id || !m.para)
    );
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
    // El buzón de soporte visto por el empleado no tiene UNA persona enfrente, así que no hay
    // presencia que mostrar: abrir un canal contra un id que no existe solo gastaría una conexión
    // y encendería un punto de "está aquí" que no significaría nada.
    if (selected.usuario.id === CANAL_SOPORTE.id) return undefined;

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
        // Sale de la conversación y no de `selected.usuario.id`: en el buzón de soporte visto por
        // el empleado es nulo (el canal no es una persona) y el servidor lo espera así.
        para: selected.para,
        canal: selected.canal,
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
        subtitle={!veChat
          ? "Convoca reuniones por vídeo con el personal."
          : atiendeSoporte
            ? "Tu canal con la psicóloga y el buzón de Soporte TI que atiendes."
            : user.role === "psicologa"
              ? "Canal privado de comunicación con el personal."
              : "Canal privado con la psicóloga, y Soporte TI para problemas del sistema."}
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
        // `--detalle` cuando la persona ha ABIERTO una conversación (selectedId), no cuando
        // simplemente hay una seleccionada: `selected` cae por defecto en la primera, así que en
        // el teléfono siempre había un chat abierto y la lista quedaba aplastada a 72px — cabía
        // una conversación y media, y Soporte TI se quedaba fuera de la vista. En escritorio la
        // clase no cambia nada: allí caben las dos columnas.
        <div className={`mensajes-layout${conversacionesActivas.length === 1 ? " mensajes-layout--single" : ""}${selectedId ? " mensajes-layout--detalle" : ""}`}>
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
                  ? `${c.ultimo.de === user.id ? "Tú: " : ""}${resumenDe(c.ultimo)}`
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
                      zoom={false}
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

              {/* Quien atiende soporte solo ve un hilo cuando alguien ya escribió, así que
                  con el buzón vacío la lista se quedaba con la conversación de la psicóloga
                  y nada más — justo debajo de una cabecera que promete "el buzón de Soporte
                  TI que atiendes". Parecía roto sin estarlo. Este renglón dice que el buzón
                  está ahí y que simplemente no hay nada. */}
              {atiendeSoporte && !conversacionesActivas.some(c => c.canal === "soporte") && (
                <p className="mensajes-conv-vacio">
                  <Icon name="wrench" size={14} />
                  Buzón de Soporte TI · nadie ha escrito todavía
                </p>
              )}
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
                  {/* Solo se ve en el telefono, donde el chat tapa la lista. En escritorio las
                      dos columnas conviven y un boton de volver no significaria nada. */}
                  <button
                    type="button"
                    className="mensajes-chat-volver"
                    onClick={() => setSelectedId(null)}
                    aria-label="Volver a las conversaciones"
                  >
                    <Icon name="chevronDown" size={18} className="mensajes-chat-volver-icono" />
                  </button>
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
                  {selected.canal === "soporte" ? (
                    <span className="mensajes-private-pill">
                      <Icon name="wrench" size={12} /> Soporte TI
                    </span>
                  ) : (
                    <span className="mensajes-private-pill">
                      <Icon name="lock" size={12} /> Privado
                    </span>
                  )}
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
