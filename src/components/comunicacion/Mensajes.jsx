import React, { useState, useEffect, useRef } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { getPsicologaPrincipal, formatUsuarioMensajesMeta } from "../../utils/psicologa";

// Orden cronológico: los ids son uuid (no ordenables), se ordena por fecha (ISO, sortable como string).
const porTiempo = (a, b) => String(a.fecha || "").localeCompare(String(b.fecha || ""));

// "2026-06-30 14:05" -> "14:05" (si trae hora); si solo fecha, la muestra.
const formatHora = (fecha) => {
  const s = String(fecha || "");
  const partes = s.split(" ");
  return partes[1] ? partes[1] : s;
};

const Mensajes = ({ user, mensajes, onSend, onMarkRead = () => {} }) => {
  const { usuarios: USERS } = useGlobal();

  const [selectedId, setSelectedId] = useState(null);
  const [texto, setTexto] = useState("");
  const bodyRef = useRef(null);

  const psicologa = getPsicologaPrincipal(USERS);
  const empleados = USERS.filter(u => u.role === "empleado");
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

  const enviar = async () => {
    if (!selected || !texto.trim()) return;
    const ok = await onSend({
      de: user.id,
      para: selected.usuario.id,
      texto: texto.trim(),
      fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
      leido: false,
    });
    if (ok) setTexto("");
  };

  const sinConversacionesActivas = conversacionesActivas.length === 0;

  return (
    <div className="admin-page mensajes-page">
      <PageHeader
        className="mensajes-page-header"
        icon="message"
        title="Mensajes"
        subtitle="Canal privado de comunicación entre empleado y psicóloga."
      />

      {sinConversacionesActivas ? (
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
                      color={activo ? "#00897B" : "#64748b"}
                      photoUrl={c.usuario.avatarUrl}
                    />

                    <div className="mensajes-conv-main">
                      <div className="mensajes-conv-name">{c.usuario.name}</div>
                      <div className="mensajes-conv-meta">
                        {preview || formatUsuarioMensajesMeta(c.usuario)}
                      </div>
                    </div>

                    <div className="mensajes-conv-side">
                      {c.ultimo && <span className="mensajes-conv-time">{formatHora(c.ultimo.fecha)}</span>}
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
                  <Avatar name={selected.usuario.name} size={40} color="#00897B" photoUrl={selected.usuario.avatarUrl} />
                  <div>
                    <div className="mensajes-chat-name">{selected.usuario.name}</div>
                    <div className="mensajes-chat-meta">{formatUsuarioMensajesMeta(selected.usuario)}</div>
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
                  ) : mensajesChat.map(m => {
                    const mio = m.de === user.id;
                    const autor = getUserById(m.de);

                    return (
                      <div key={m.id} className={`mensajes-bubble-row${mio ? " mensajes-bubble-row--mine" : ""}`}>
                        <div className={`mensajes-bubble${mio ? " mensajes-bubble--mine" : ""}`}>
                          <div className="mensajes-bubble-author">
                            {mio ? "Tú" : autor?.name || "Usuario"}
                          </div>
                          <div className="mensajes-bubble-text">{m.texto}</div>
                          <div className="mensajes-bubble-time">{formatHora(m.fecha)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mensajes-composer">
                  <input
                    className="mensajes-composer-input"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") enviar();
                    }}
                    placeholder="Escribe un mensaje privado..."
                  />
                  <button
                    type="button"
                    className="mc-btn-primary mc-btn-with-icon"
                    onClick={enviar}
                    disabled={!texto.trim()}
                  >
                    <Icon name="message" size={16} /> Enviar
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default Mensajes;
