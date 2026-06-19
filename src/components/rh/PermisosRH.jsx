import React, { useState, useEffect, useRef } from "react";
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
import { db } from "../../config/firebase";
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";

const PermisosRH = ({ permisos, onUpdateEstado }) => {
  const pendientes = permisos.filter(p => p.estado === "pendiente").length;
  const aprobados = permisos.filter(p => p.estado === "aprobado").length;
  const rechazados = permisos.filter(p => p.estado === "rechazado").length;

  const badgeStyle = (estado) => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      estado === "aprobado" ? "#dcfce7" :
      estado === "rechazado" ? "#fee2e2" :
      "#fef3c7",
    color:
      estado === "aprobado" ? "#166534" :
      estado === "rechazado" ? "#991b1b" :
      "#92400e"
  });

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Permisos
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Registro, autorización y seguimiento de permisos administrativos del personal.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>⏳</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f59e0b" }}>{pendientes}</div>
          <div style={{ fontWeight: 700 }}>Pendientes</div>
        </Card>
        <Card>
          <div style={{ fontSize: 24 }}>✅</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#22c55e" }}>{aprobados}</div>
          <div style={{ fontWeight: 700 }}>Aprobados</div>
        </Card>
        <Card>
          <div style={{ fontSize: 24 }}>❌</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#ef4444" }}>{rechazados}</div>
          <div style={{ fontWeight: 700 }}>Rechazados</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>📝 Solicitudes de permisos</h3>

        <div style={{ display: "grid", gap: 12 }}>
          {permisos.map(p => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 0",
                borderBottom: "1px solid #e5e7eb"
              }}
            >
              <div>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{p.empleado}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {p.sucursal} · {p.puesto}
                </div>
                <div style={{ color: "#334155", fontSize: 13, marginTop: 4 }}>
                  {p.tipo}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>
                  Motivo: {p.motivo}
                </div>
                {p.comentarioRH && (
  <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
    Comentario RH: {p.comentarioRH}
  </div>
)}
              </div>

              <div style={{ color: "#334155", fontSize: 14 }}>
                {p.fecha}
                <div style={{ color: "#64748b", fontSize: 12 }}>Hora: {p.hora}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>{p.observaciones}</div>
              </div>

              <div>
                <span style={badgeStyle(p.estado)}>{p.estado}</span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {p.estado === "pendiente" ? (
                  <>
                    <button
                      onClick={() => {
  const comentarioRH = window.prompt("Comentario opcional de RH:");
  onUpdateEstado(p.id, "aprobado", comentarioRH || "");
}}
                      style={{
                        border: "none",
                        background: "#00897B",
                        color: "white",
                        padding: "8px 10px",
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => {
  const comentarioRH = window.prompt("Comentario opcional de RH:");
  onUpdateEstado(p.id, "rechazado", comentarioRH || "");
}}
                      style={{
                        border: "none",
                        background: "#ef4444",
                        color: "white",
                        padding: "8px 10px",
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Rechazar
                    </button>
                  </>
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>Sin acciones</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};


export default PermisosRH;
