import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";


const ReportesConfidencialesPanel = ({ reportes }) => {
  const { usuarios: USERS } = useGlobal();

  const nuevos = reportes.filter(r => r.estado === "nuevo").length;
  const seguimiento = reportes.filter(r => r.estado === "en seguimiento").length;
  const altas = reportes.filter(r => r.urgencia === "Alta" || r.urgencia === "Crítica").length;

  const urgenciaStyle = (urgencia) => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background:
      urgencia === "Crítica" ? "#fee2e2" :
      urgencia === "Alta" ? "#ffedd5" :
      urgencia === "Media" ? "#fef3c7" :
      "#dcfce7",
    color:
      urgencia === "Crítica" ? "#991b1b" :
      urgencia === "Alta" ? "#c2410c" :
      urgencia === "Media" ? "#92400e" :
      "#166534"
  });

  const estadoStyle = (estado) => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background:
      estado === "nuevo" ? "#dbeafe" :
      estado === "en seguimiento" ? "#fef3c7" :
      "#dcfce7",
    color:
      estado === "nuevo" ? "#1e40af" :
      estado === "en seguimiento" ? "#92400e" :
      "#166534"
  });

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Reportes Confidenciales
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Bandeja confidencial visible únicamente para Psicóloga y Admin Principal.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>🔒</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#00897B" }}>{reportes.length}</div>
          <div style={{ fontWeight: 700 }}>Reportes totales</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>🆕</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#2563eb" }}>{nuevos}</div>
          <div style={{ fontWeight: 700 }}>Nuevos</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>🎯</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f59e0b" }}>{seguimiento}</div>
          <div style={{ fontWeight: 700 }}>En seguimiento</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>🚨</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#ef4444" }}>{altas}</div>
          <div style={{ fontWeight: 700 }}>Alta prioridad</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>📋 Bandeja de reportes</h3>

        <div style={{ display: "grid", gap: 14 }}>
          {reportes.map(r => (
            <div
              key={r.id}
              style={{
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                background: "#f8fafc"
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 10
              }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 17 }}>
                    {r.empleado}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {r.sucursal} · {r.puesto} · {r.fecha}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={urgenciaStyle(r.urgencia)}>{r.urgencia}</span>
                  <span style={estadoStyle(r.estado)}>{r.estado}</span>
                </div>
              </div>

              <div style={{ color: "#004D40", fontWeight: 900, marginBottom: 6 }}>
                🔒 {r.tipo}
              </div>

              <div style={{ color: "#334155", lineHeight: 1.6, marginBottom: 8 }}>
                {r.descripcion}
              </div>

              <div style={{ color: "#64748b", fontSize: 13 }}>
                <b>Evidencias:</b> {r.evidencias}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ReportesConfidencialesPanel;
