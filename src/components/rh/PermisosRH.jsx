import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { useNotification } from "../../contexts/NotificationContext";

const PermisosRH = ({ permisos, onUpdateEstado }) => {
  const { prompt } = useNotification();

  const pendientes = permisos.filter(p => p.estado === "pendiente").length;
  const aprobados = permisos.filter(p => p.estado === "aprobado").length;
  const rechazados = permisos.filter(p => p.estado === "rechazado").length;

  const handleEstado = async (id, estado) => {
    const comentarioRH = await prompt({
      title: estado === "aprobado" ? "Aprobar permiso" : "Rechazar permiso",
      description: "Comentario opcional de RH:",
      placeholder: "Escribe un comentario (opcional)",
      confirmText: estado === "aprobado" ? "Aprobar" : "Rechazar",
    });
    if (comentarioRH === null) return;
    onUpdateEstado(id, estado, comentarioRH || "");
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Permisos</h1>
        <p className="admin-page-subtitle">
          Registro, autorización y seguimiento de permisos administrativos del personal.
        </p>
      </div>

      <div className="admin-stat-grid">
        <StatCard iconName="clock" value={pendientes} label="Pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="check" value={aprobados} label="Aprobados" valueClass="admin-stat-value--green" />
        <StatCard iconName="xCircle" value={rechazados} label="Rechazados" valueClass="admin-stat-value--red" />
      </div>

      <Card>
        <SectionTitle icon="clipboard">Solicitudes de permisos</SectionTitle>

        <div className="rh-data-list">
          {permisos.map(p => (
            <div key={p.id} className="rh-data-row">
              <div className="rh-data-row-main">
                <div className="rh-data-row-title">{p.empleado}</div>
                <div className="rh-data-row-sub">{normalizeSucursal(p.sucursal)} · {p.puesto}</div>
                <div className="rh-data-row-detail">{p.tipo}</div>
                <div className="rh-data-row-note">Motivo: {p.motivo}</div>
                {p.comentarioRH && (
                  <div className="rh-data-row-note">Comentario RH: {p.comentarioRH}</div>
                )}
              </div>

              <div className="rh-data-row-meta">
                <div className="rh-data-row-meta-primary">{p.fecha}</div>
                <div className="rh-data-row-meta-secondary">Hora: {p.hora}</div>
                {p.observaciones && (
                  <div className="rh-data-row-note">{p.observaciones}</div>
                )}
              </div>

              <div className="rh-data-row-status">
                <span className={`mc-status-pill mc-status-pill--${p.estado}`}>{p.estado}</span>
              </div>

              <div className="rh-data-row-actions">
                {p.estado === "pendiente" ? (
                  <>
                    <button
                      type="button"
                      className="mc-btn-primary mc-btn-sm-action"
                      onClick={() => handleEstado(p.id, "aprobado")}
                    >
                      <Icon name="check" size={14} /> Aprobar
                    </button>
                    <button
                      type="button"
                      className="mc-btn-danger mc-btn-sm-action"
                      onClick={() => handleEstado(p.id, "rechazado")}
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

export default PermisosRH;
