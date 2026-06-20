import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";

import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";

const HistorialEmpleado = ({ user, encuestas }) => {
  const { usuarios: USERS } = useGlobal();

  const historial = encuestas
    .filter(e => e.empleadoId === user.id)
    .slice()
    .sort((a, b) => b.semana.localeCompare(a.semana));

  const promedio = historial.length
    ? Math.round(historial.reduce((sum, e) => sum + e.score, 0) / historial.length)
    : 0;

  const mejor = historial.length
    ? Math.max(...historial.map(e => e.score))
    : 0;

  const ultima = historial[0];

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40", textAlign: "center" }}>
        Mi Historial
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b", textAlign: "center" }}>
        Consulta privada de tus mediciones semanales de bienestar.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>📊</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#00897B" }}>
            {historial.length}
          </div>
          <div style={{ fontWeight: 800 }}>Encuestas registradas</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>💓</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#00897B" }}>
            {promedio}
          </div>
          <div style={{ fontWeight: 800 }}>Promedio personal</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>⭐</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#00897B" }}>
            {mejor}
          </div>
          <div style={{ fontWeight: 800 }}>Mejor score</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>🗓️</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#00897B" }}>
            {ultima?.semana || "N/A"}
          </div>
          <div style={{ fontWeight: 800 }}>Última medición</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>
          📋 Historial semanal
        </h3>

        {historial.length === 0 ? (
          <p style={{ color: "#64748b" }}>
            Aún no tienes encuestas registradas.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {historial.map(e => {
              const status = getPulseStatus(e.score);

              return (
                <div
                  key={`${e.empleadoId}-${e.semana}`}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    background: "#f8fafc",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 17 }}>
                      🗓️ {e.semana}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      Resultado semanal de bienestar
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: status.color }}>
                     {Number.isFinite(Number(e.score)) ? Number(e.score) : 50} pts
                    </div>
                    <span style={{
                      display: "inline-block",
                      padding: "5px 10px",
                      borderRadius: 999,
                      background: status.bg,
                      color: status.color,
                      fontWeight: 900,
                      fontSize: 12
                    }}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 14,
        background: "#ecfeff",
        border: "1px solid #bae6fd",
        color: "#004D40",
        lineHeight: 1.6,
        textAlign: "center",
        fontWeight: 700
      }}>
        🔒 Este historial es privado. Solo muestra tus propias respuestas y resultados.
      </div>
    </div>
  );
};


export default HistorialEmpleado;
