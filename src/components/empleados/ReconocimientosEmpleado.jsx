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

const ReconocimientosEmpleado = ({ user, reconocimientos }) => {
  const misReconocimientos = reconocimientos.filter(r => r.empleadoId === user.id);

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Mis Reconocimientos
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Historial de reconocimientos recibidos dentro de McDental.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>🏅</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#00897B" }}>
            {misReconocimientos.length}
          </div>
          <div style={{ fontWeight: 700 }}>Reconocimientos recibidos</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>🏅 Historial</h3>

        {misReconocimientos.length === 0 ? (
          <p style={{ color: "#64748b" }}>Aún no tienes reconocimientos registrados.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {misReconocimientos.map(r => (
              <div
                key={r.id}
                style={{
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  background: "#f8fafc"
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900, color: "#004D40" }}>
                  🏅 {r.categoria}
                </div>
                <div style={{ color: "#64748b", fontSize: 13, margin: "4px 0 10px" }}>
                  {r.fecha} · Otorgado por {r.otorgadoPor}
                </div>
                <div style={{ color: "#334155", lineHeight: 1.6 }}>
                  {r.comentario}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};


export default ReconocimientosEmpleado;
