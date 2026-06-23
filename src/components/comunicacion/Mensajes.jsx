import React, { useState, useEffect } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";

const Mensajes = ({ user, mensajes, onSend }) => {
  const { usuarios: USERS } = useGlobal();

  const [selectedId, setSelectedId] = useState(null);
  const [texto, setTexto] = useState("");
  const [readCounts, setReadCounts] = useState({});

  const psicologa = USERS.find(u => u.role === "psicologa");
  const empleados = USERS.filter(u => u.role === "empleado");

  const getUserById = (id) => USERS.find(u => u.id === id);

  const conversaciones = user.role === "psicologa"
    ? empleados.map(emp => {
        const convMensajes = mensajes.filter(m =>
          (m.de === user.id && m.para === emp.id) ||
          (m.de === emp.id && m.para === user.id)
        );

        const ultimo = convMensajes[convMensajes.length - 1];

        return {
          usuario: emp,
          mensajes: convMensajes,
          ultimo,
          noLeidos: convMensajes.filter(m => m.para === user.id && !m.leido).length
        };
      })
    : psicologa ? [{
        usuario: psicologa,
        mensajes,
        ultimo: mensajes[mensajes.length - 1],
        noLeidos: mensajes.filter(m => m.para === user.id && !m.leido).length
      }] : [];

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

  const marcarComoLeida = (convId, messageCount) => {
    setReadCounts(prev => ({ ...prev, [convId]: messageCount }));
  };

  useEffect(() => {
    if (!selected) return;
    marcarComoLeida(selected.usuario.id, selected.mensajes.length);
  }, [selected?.usuario.id, selected?.mensajes.length]);

  const getBadgeCount = (c) => {
    if (selected?.usuario.id === c.usuario.id) return 0;

    const readAt = readCounts[c.usuario.id];
    if (readAt === undefined) {
      if (c.noLeidos > 0) return c.noLeidos;
      const entrantes = c.mensajes.filter(m => m.para === user.id).length;
      return entrantes > 0 ? entrantes : 0;
    }

    const nuevosDesdeLeida = c.mensajes.length - readAt;
    return nuevosDesdeLeida > 0 ? nuevosDesdeLeida : 0;
  };

  const seleccionarConversacion = (c) => {
    setSelectedId(c.usuario.id);
    marcarComoLeida(c.usuario.id, c.mensajes.length);
  };

  const enviar = () => {
    if (!selected || !texto.trim()) return;

    onSend({
      de: user.id,
      para: selected.usuario.id,
      texto: texto.trim(),
      fecha: new Date().toISOString().slice(0, 16).replace("T", " "),
      leido: false
    });

    setTexto("");
  };

  const sinConversacionesActivas = conversacionesActivas.length === 0;

  return (
    <div className="admin-page mensajes-page">
      <div className="admin-page-header mensajes-page-header">
        <h1 className="admin-page-title">Mensajes</h1>
        <p className="admin-page-subtitle">
          Canal privado de comunicación entre empleado y psicóloga.
        </p>
      </div>

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
        <div className="mensajes-layout">
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
                const badgeCount = getBadgeCount(c);
                const showBadge = badgeCount > 0;

                return (
                  <button
                    key={c.usuario.id}
                    type="button"
                    className={`mensajes-conv-item${activo ? " mensajes-conv-item--active" : ""}`}
                    onClick={() => seleccionarConversacion(c)}
                  >
                    <Avatar
                      name={c.usuario.name}
                      size={36}
                      color={activo ? "#00897B" : "#64748b"}
                    />

                    <div className="mensajes-conv-main">
                      <div className="mensajes-conv-name">{c.usuario.name}</div>
                      <div className="mensajes-conv-meta">
                        {c.usuario.puesto} · {normalizeSucursal(c.usuario.sucursal)}
                      </div>
                    </div>

                    {showBadge && (
                      <span
                        className="mensajes-conv-badge mensajes-conv-badge--unread"
                        title={`${badgeCount} no leídos`}
                      >
                        {badgeCount}
                      </span>
                    )}
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
                  <Avatar name={selected.usuario.name} size={40} color="#00897B" />
                  <div>
                    <div className="mensajes-chat-name">{selected.usuario.name}</div>
                    <div className="mensajes-chat-meta">{selected.usuario.puesto} · {normalizeSucursal(selected.usuario.sucursal)}</div>
                  </div>
                  <span className="mensajes-private-pill">
                    <Icon name="lock" size={12} /> Privado
                  </span>
                </div>

                <div className="mensajes-chat-body">
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
                          <div className="mensajes-bubble-time">{m.fecha}</div>
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
                  <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={enviar}>
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
