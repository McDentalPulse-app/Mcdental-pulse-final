import React from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { getPulseStatus } from "../../utils/pulseScore";

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

      <div className="admin-stat-grid">
        <StatCard iconName="chart" value={historial.length} label="Encuestas registradas" valueClass="admin-stat-value--green" />
        <StatCard iconName="heart" value={promedio} label="Promedio personal" valueClass="admin-stat-value--green" />
        <StatCard iconName="star" value={mejor} label="Mejor score" valueClass="admin-stat-value--green" />
        <StatCard iconName="calendarDays" value={ultima?.semana || "N/A"} label="Última medición" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="clipboard">Historial semanal</SectionTitle>

        {historial.length === 0 ? (
          <p style={{ color: "#64748b" }}>Aún no tienes encuestas registradas.</p>
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
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="calendarDays" size={16} /> {e.semana}
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
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8
      }}>
        <Icon name="lock" size={16} />
        Este historial es privado. Solo muestra tus propias respuestas y resultados.
      </div>
    </div>
  );
};


export default HistorialEmpleado;
