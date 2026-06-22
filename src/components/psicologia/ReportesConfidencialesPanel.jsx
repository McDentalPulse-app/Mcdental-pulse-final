import React from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";

const ReportesConfidencialesPanel = ({ reportes }) => {
  const { usuarios: USERS } = useGlobal();

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
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Reportes Confidenciales</h1>
        <p className="admin-page-subtitle">
          Bandeja confidencial visible únicamente para Psicóloga y Admin Principal.
        </p>
      </div>

      <div className="admin-stat-grid">
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🔒</div>
          <div className="admin-stat-value admin-stat-value--green">{reportes.length}</div>
          <div className="admin-stat-label">Reportes totales</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🆕</div>
          <div className="admin-stat-value admin-stat-value--blue">{nuevos}</div>
          <div className="admin-stat-label">Nuevos</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🎯</div>
          <div className="admin-stat-value admin-stat-value--amber">{seguimiento}</div>
          <div className="admin-stat-label">En seguimiento</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🚨</div>
          <div className="admin-stat-value admin-stat-value--red">{altas}</div>
          <div className="admin-stat-label">Alta prioridad</div>
        </Card>
      </div>

      <Card>
        <h3 className="admin-section-title">📋 Bandeja de reportes</h3>
        <div className="admin-list-scroll admin-list-scroll--tall">
          {reportes.map(r => (
            <div key={r.id} className="admin-list-item">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap" }}>
                <div>
                  <div className="admin-list-item-title">{r.empleado}</div>
                  <div className="admin-list-item-meta">{r.sucursal} · {r.puesto} · {r.fecha}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className={urgenciaClass(r.urgencia)}>{r.urgencia}</span>
                  <span className={estadoClass(r.estado)}>{r.estado}</span>
                </div>
              </div>
              <div style={{ color: "var(--mc-verde-oscuro)", fontWeight: 800, marginBottom: 6 }}>🔒 {r.tipo}</div>
              <div className="admin-list-item-body">{r.descripcion}</div>
              <div className="admin-list-item-meta" style={{ marginTop: 8 }}><b>Evidencias:</b> {r.evidencias}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ReportesConfidencialesPanel;
