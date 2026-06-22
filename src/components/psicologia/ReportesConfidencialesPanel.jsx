import React from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import StatCard from "../common/StatCard";
import Icon from "../ui/Icon";

const ReportesConfidencialesPanel = ({ reportes }) => {
  const nuevos = reportes.filter(r => r.estado === "nuevo").length;
  const seguimiento = reportes.filter(r => r.estado === "en seguimiento").length;
  const altas = reportes.filter(r => r.urgencia === "Alta" || r.urgencia === "Crítica").length;

  const urgenciaClass = (urgencia) => {
    if (urgencia === "Crítica") return "mc-status-pill mc-status-pill--critica";
    if (urgencia === "Alta") return "mc-status-pill mc-status-pill--alta";
    if (urgencia === "Media") return "mc-status-pill mc-status-pill--media";
    return "mc-status-pill mc-status-pill--baja";
  };

  const estadoClass = (estado) => {
    if (estado === "nuevo") return "mc-status-pill mc-status-pill--nuevo";
    if (estado === "en seguimiento") return "mc-status-pill mc-status-pill--seguimiento";
    return "mc-status-pill mc-status-pill--cerrado";
  };

  return (
    <div className="admin-page psico-confidenciales-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Reportes Confidenciales</h1>
        <p className="admin-page-subtitle">
          Bandeja confidencial visible únicamente para Psicóloga y Admin Principal.
        </p>
      </div>

      <div className="admin-info-box psico-confidential-info">
        <Icon name="shield" size={16} />
        <span>Contenido protegido · uso exclusivo clínico-administrativo · no compartir fuera del canal autorizado.</span>
      </div>

      <div className="admin-stat-grid">
        <StatCard iconName="lock" value={reportes.length} label="Reportes totales" valueClass="admin-stat-value--green" />
        <StatCard iconName="inbox" value={nuevos} label="Nuevos" valueClass="admin-stat-value--blue" />
        <StatCard iconName="target" value={seguimiento} label="En seguimiento" valueClass="admin-stat-value--amber" />
        <StatCard iconName="shieldAlert" value={altas} label="Alta prioridad" valueClass="admin-stat-value--red" />
      </div>

      <Card className="psico-inbox-card">
        <SectionTitle icon="clipboard">Bandeja de reportes</SectionTitle>
        <div className="psico-inbox-list admin-list-scroll admin-list-scroll--tall">
          {reportes.length === 0 ? (
            <p className="admin-empty">No hay reportes confidenciales registrados.</p>
          ) : reportes.map(r => (
            <div key={r.id} className="psico-inbox-item">
              <div className="psico-inbox-head">
                <div>
                  <div className="admin-list-item-title">{r.empleado}</div>
                  <div className="admin-list-item-meta">{r.sucursal} · {r.puesto} · {r.fecha}</div>
                </div>
                <div className="psico-inbox-badges">
                  <span className={urgenciaClass(r.urgencia)}>{r.urgencia}</span>
                  <span className={estadoClass(r.estado)}>{r.estado}</span>
                </div>
              </div>
              <div className="psico-inbox-type">
                <Icon name="lock" size={14} /> {r.tipo}
              </div>
              <div className="admin-list-item-body">{r.descripcion}</div>
              <div className="admin-list-item-meta psico-inbox-evidence">
                <strong>Evidencias:</strong> {r.evidencias}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ReportesConfidencialesPanel;
