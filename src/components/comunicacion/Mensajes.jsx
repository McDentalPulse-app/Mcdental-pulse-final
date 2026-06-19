import React, { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";
import { USERS } from "../../data/initialData";
import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";

const Mensajes = ({ user, mensajes, onSend }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [texto, setTexto] = useState("");

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

  const selected = selectedId
    ? conversaciones.find(c => c.usuario.id === selectedId)
    : conversaciones[0];

  const mensajesChat = selected?.mensajes || [];

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

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Mensajes
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Canal privado de comunicación entre empleado y psicóloga.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "300px 1fr",
        gap: 16,
        minHeight: 620
      }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            padding: 16,
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 900,
            color: "#004D40"
          }}>
            Conversaciones privadas
          </div>

          <div style={{ display: "grid" }}>
            {conversaciones.length === 0 ? (
              <div style={{ padding: 16, color: "#64748b" }}>
                No hay conversaciones disponibles.
              </div>
            ) : conversaciones.map(c => {
              const activo = selected?.usuario.id === c.usuario.id;

              return (
                <button
                  key={c.usuario.id}
                  onClick={() => setSelectedId(c.usuario.id)}
                  style={{
                    border: "none",
                    textAlign: "left",
                    padding: 14,
                    cursor: "pointer",
                    background: activo ? "#ecfeff" : "white",
                    borderBottom: "1px solid #e5e7eb"
                  }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10
                  }}>
                    <Avatar
                      name={c.usuario.name}
                      size={36}
                      color={activo ? "#00897B" : "#64748b"}
                    />

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: 900,
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}>
                        {c.usuario.name}
                      </div>

                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {c.usuario.puesto} · {c.usuario.sucursal}
                      </div>
                    </div>

                    {c.noLeidos > 0 && (
                      <div style={{
                        background: "#ef4444",
                        color: "white",
                        borderRadius: 999,
                        padding: "3px 7px",
                        fontSize: 11,
                        fontWeight: 900
                      }}>
                        {c.noLeidos}
                      </div>
                    )}
                  </div>

                  <div style={{
                    marginTop: 8,
                    color: "#64748b",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {c.ultimo ? c.ultimo.texto : "Sin mensajes todavía"}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card style={{
          padding: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          {!selected ? (
            <div style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              color: "#94a3b8"
            }}>
              Selecciona una conversación
            </div>
          ) : (
            <>
              <div style={{
                padding: 16,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                gap: 10
              }}>
                <Avatar name={selected.usuario.name} size={40} color="#00897B" />
                <div>
                  <div style={{ fontWeight: 900, color: "#004D40" }}>
                    {selected.usuario.name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {selected.usuario.puesto} · {selected.usuario.sucursal}
                  </div>
                </div>

                <div style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "#64748b",
                  background: "#f8fafc",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb"
                }}>
                  🔒 Privado
                </div>
              </div>

              <div style={{
                flex: 1,
                padding: 18,
                background: "#f8fafc",
                overflowY: "auto",
                display: "grid",
                alignContent: "start",
                gap: 12
              }}>
                {mensajesChat.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    color: "#94a3b8",
                    padding: 40
                  }}>
                    No hay mensajes todavía. Inicia la conversación.
                  </div>
                ) : mensajesChat.map(m => {
                  const mio = m.de === user.id;
                  const autor = getUserById(m.de);

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: mio ? "flex-end" : "flex-start"
                      }}
                    >
                      <div style={{
                        maxWidth: "72%",
                        padding: "12px 14px",
                        borderRadius: 16,
                        background: mio ? "#00897B" : "white",
                        color: mio ? "white" : "#0f172a",
                        border: mio ? "none" : "1px solid #e5e7eb"
                      }}>
                        <div style={{
                          fontSize: 11,
                          fontWeight: 800,
                          opacity: 0.8,
                          marginBottom: 4
                        }}>
                          {mio ? "Tú" : autor?.name || "Usuario"}
                        </div>

                        <div style={{ lineHeight: 1.5 }}>
                          {m.texto}
                        </div>

                        <div style={{
                          fontSize: 11,
                          opacity: 0.75,
                          marginTop: 6,
                          textAlign: "right"
                        }}>
                          {m.fecha}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{
                padding: 14,
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: 10
              }}>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") enviar();
                  }}
                  placeholder="Escribe un mensaje privado..."
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1"
                  }}
                />

                <button
                  onClick={enviar}
                  style={{
                    border: "none",
                    background: "#00897B",
                    color: "white",
                    padding: "0 18px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer"
                  }}
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};


export default Mensajes;
