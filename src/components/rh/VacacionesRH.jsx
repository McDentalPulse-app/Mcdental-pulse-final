import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { useNotification } from "../../contexts/NotificationContext";

const VacacionesRH = ({ vacaciones, onUpdateEstado }) => {
  const { prompt } = useNotification();

  const pendientes = vacaciones.filter(v => v.estado === "pendiente").length;
  const aprobadas = vacaciones.filter(v => v.estado === "aprobado").length;
  const rechazadas = vacaciones.filter(v => v.estado === "rechazado").length;

  const handleEstado = async (id, estado) => {
    const comentarioRH = await prompt({
      title: estado === "aprobado" ? "Aprobar vacaciones" : "Rechazar vacaciones",
      description: "Comentario opcional de RH:",
      placeholder: "Escribe un comentario (opcional)",
      confirmText: estado === "aprobado" ? "Aprobar" : "Rechazar",
    });
    if (comentarioRH === null) return;
    onUpdateEstado(id, estado, comentarioRH || "");
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="vacation"
        title="Vacaciones"
        subtitle="Gestión de solicitudes, aprobación y seguimiento de vacaciones del personal."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="clock" value={pendientes} label="Pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="check" value={aprobadas} label="Aprobadas" valueClass="admin-stat-value--green" />
        <StatCard iconName="xCircle" value={rechazadas} label="Rechazadas" valueClass="admin-stat-value--red" />
      </div>

      <Card>
        <SectionTitle icon="vacation">Solicitudes de vacaciones</SectionTitle>

        <div className="rh-data-list">
          {/* Pendientes primero (sort estable: dentro de cada grupo se conserva el orden). */}
          {[...vacaciones].sort((a, b) => (b.estado === "pendiente") - (a.estado === "pendiente")).map(v => (
            <div key={v.id} className="rh-data-row">
              <div className="rh-data-row-main">
                <div className="rh-data-row-title">{v.empleado}</div>
                <div className="rh-data-row-sub">{normalizeSucursal(v.sucursal)} · {v.puesto}</div>
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
                      onClick={() => handleEstado(v.id, "aprobado")}
                    >
                      <Icon name="check" size={14} /> Aprobar
                    </button>
                    <button
                      type="button"
                      className="mc-btn-danger mc-btn-sm-action"
                      onClick={() => handleEstado(v.id, "rechazado")}
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
