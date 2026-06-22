import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";

const VacacionesRH = ({ vacaciones, onUpdateEstado }) => {
  const pendientes = vacaciones.filter(v => v.estado === "pendiente").length;
  const aprobadas = vacaciones.filter(v => v.estado === "aprobada").length;
  const rechazadas = vacaciones.filter(v => v.estado === "rechazada").length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Vacaciones</h1>
        <p className="admin-page-subtitle">
          Gestión de solicitudes, aprobación y seguimiento de vacaciones del personal.
        </p>
      </div>

      <div className="admin-stat-grid">
        <StatCard iconName="clock" value={pendientes} label="Pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="check" value={aprobadas} label="Aprobadas" valueClass="admin-stat-value--green" />
        <StatCard iconName="xCircle" value={rechazadas} label="Rechazadas" valueClass="admin-stat-value--red" />
      </div>

      <Card>
        <SectionTitle icon="vacation">Solicitudes de vacaciones</SectionTitle>

        <div className="rh-data-list">
          {vacaciones.map(v => (
            <div key={v.id} className="rh-data-row">
              <div className="rh-data-row-main">
                <div className="rh-data-row-title">{v.empleado}</div>
                <div className="rh-data-row-sub">{v.sucursal} · {v.puesto}</div>
                <div className="rh-data-row-note">Motivo: {v.motivo}</div>
              </div>

              <div className="rh-data-row-meta">
                <div className="rh-data-row-meta-primary">{v.inicio} al {v.fin}</div>
                <div className="rh-data-row-meta-secondary">{v.dias} días</div>
              </div>

              <div className="rh-data-row-status">
                <span className={`mc-status-pill mc-status-pill--${v.estado}`}>{v.estado}</span>
              </div>

              <div className="rh-data-row-actions">
                {v.estado === "pendiente" ? (
                  <>
                    <button
                      type="button"
                      className="mc-btn-primary mc-btn-sm-action"
                      onClick={() => {
                        const comentarioRH = window.prompt("Comentario opcional de RH:");
                        onUpdateEstado(v.id, "aprobada", comentarioRH || "");
                      }}
                    >
                      <Icon name="check" size={14} /> Aprobar
                    </button>
                    <button
                      type="button"
                      className="mc-btn-danger mc-btn-sm-action"
                      onClick={() => {
                        const comentarioRH = window.prompt("Comentario opcional de RH:");
                        onUpdateEstado(v.id, "rechazada", comentarioRH || "");
                      }}
                    >
                      <Icon name="xCircle" size={14} /> Rechazar
                    </button>
                  </>
                ) : (
                  <span className="rh-data-row-muted">Sin acciones</span>
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
