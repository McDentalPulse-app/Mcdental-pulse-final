import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { formatSemanaDisplay, normalizeWeek } from "../../utils/constants";
import { getPulseStatus } from "../../utils/pulseScore";

const HistorialEmpleado = ({ user, encuestas }) => {
  const historial = encuestas
    .filter(e => e.empleadoId === user.id)
    .slice()
    .sort((a, b) => normalizeWeek(b.semana).localeCompare(normalizeWeek(a.semana)));

  const promedio = historial.length
    ? Math.round(historial.reduce((sum, e) => sum + e.score, 0) / historial.length)
    : 0;

  const mejor = historial.length
    ? Math.max(...historial.map(e => e.score))
    : 0;

  const ultima = historial[0];

  return (
    <div className="admin-page empleado-page">
      <PageHeader
        icon="history"
        title="Mi historial"
        subtitle="Consulta privada de tus mediciones semanales de bienestar."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="chart" value={historial.length} label="Encuestas registradas" valueClass="admin-stat-value--green" />
        <StatCard iconName="heart" value={promedio} label="Promedio personal" valueClass="admin-stat-value--blue" />
        <StatCard iconName="star" value={mejor} label="Mejor score" valueClass="admin-stat-value--green" />
        <StatCard iconName="calendarDays" value={ultima?.semana ? formatSemanaDisplay(ultima.semana) : "N/A"} label="Última medición" valueClass="admin-stat-value--amber" />
      </div>

      <Card>
        <SectionTitle icon="clipboard">Historial semanal</SectionTitle>

        {historial.length === 0 ? (
          <p className="admin-empty">Aún no tienes encuestas registradas.</p>
        ) : (
          <div className="empleado-timeline">
            {historial.map(e => {
              const status = getPulseStatus(e.score);

              return (
                <div key={`${e.empleadoId}-${e.semana}`} className="empleado-timeline-item">
                  <div className="empleado-timeline-main">
                    <div className="empleado-timeline-week">
                      <Icon name="calendarDays" size={16} /> {formatSemanaDisplay(e.semana)}
                    </div>
                    <div className="empleado-timeline-label">Resultado semanal de bienestar</div>
                  </div>
                  <div className="empleado-timeline-score">
                    <div className="empleado-timeline-points" style={{ color: status.color }}>
                      {Number.isFinite(Number(e.score)) ? Number(e.score) : 50} pts
                    </div>
                    <span className="mc-status-pill" style={{ background: status.bg, color: status.color }}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="psico-confidential-banner empleado-privacy-banner">
        <Icon name="lock" size={16} />
        Este historial es privado. Solo muestra tus propias respuestas y resultados.
      </div>
    </div>
  );
};

export default HistorialEmpleado;
