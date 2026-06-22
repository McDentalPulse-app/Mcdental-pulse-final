import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";

const VacacionesRH = ({ vacaciones, onUpdateEstado }) => {
  const pendientes = vacaciones.filter(v => v.estado === "pendiente").length;
  const aprobadas = vacaciones.filter(v => v.estado === "aprobada").length;
  const rechazadas = vacaciones.filter(v => v.estado === "rechazada").length;

  const badgeStyle = (estado) => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      estado === "aprobada" ? "#dcfce7" :
      estado === "rechazada" ? "#fee2e2" :
      "#fef3c7",
    color:
      estado === "aprobada" ? "#166534" :
      estado === "rechazada" ? "#991b1b" :
      "#92400e"
  });

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Vacaciones
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Gestión de solicitudes, aprobación y seguimiento de vacaciones del personal.
      </p>

      <div className="admin-stat-grid">
        <StatCard iconName="clock" value={pendientes} label="Pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="check" value={aprobadas} label="Aprobadas" valueClass="admin-stat-value--green" />
        <StatCard iconName="xCircle" value={rechazadas} label="Rechazadas" valueClass="admin-stat-value--red" />
      </div>

      <Card>
        <SectionTitle icon="vacation">Solicitudes de vacaciones</SectionTitle>

        <div style={{ display: "grid", gap: 12 }}>
          {vacaciones.map(v => (
            <div
              key={v.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 0",
                borderBottom: "1px solid #e5e7eb"
              }}
            >
              <div>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{v.empleado}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {v.sucursal} · {v.puesto}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>
                  Motivo: {v.motivo}
                </div>
              </div>

              <div style={{ color: "#334155", fontSize: 14 }}>
                {v.inicio} al {v.fin}
                <div style={{ color: "#64748b", fontSize: 12 }}>{v.dias} días</div>
              </div>

              <div>
                <span style={badgeStyle(v.estado)}>{v.estado}</span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {v.estado === "pendiente" ? (
                  <>
                    <button
                      onClick={() => {
                        const comentarioRH = window.prompt("Comentario opcional de RH:");
                        onUpdateEstado(v.id, "aprobada", comentarioRH || "");
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
                        onUpdateEstado(v.id, "rechazada", comentarioRH || "");
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

export default VacacionesRH;
