import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { useNotification } from "../../contexts/NotificationContext";
import { ETIQUETA_CAUSA, CAUSA_SALIDA_ANTICIPADA } from "../../utils/permisos";
import { minutosNoTrabajados, formatoDuracion, diaISO } from "../../utils/asistencia";

const PermisosRH = ({ permisos, onUpdateEstado, horarios = [] }) => {
  const { prompt } = useNotification();

  // Cuánto se le descontaría si se le aprueba una salida anticipada. RH tiene que verlo
  // ANTES de aprobar: es quien va a capturar ese descuento después, y aprobar sin saber
  // cuánto cuesta es aprobar a ciegas.
  const descuentoDe = (p) => {
    if (p.causa !== CAUSA_SALIDA_ANTICIPADA || !p.hora) return null;
    const turno = horarios.find(
      (h) => h.empleadoId === p.empleadoId && h.diaSemana === diaISO(p.fecha)
    );
    const min = minutosNoTrabajados(p.hora, turno);
    return min > 0 ? { min, turno } : null;
  };

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
      <PageHeader
        icon="clipboardCheck"
        title="Permisos"
        subtitle="Registro, autorización y seguimiento de permisos administrativos del personal."
      />

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
                {/* Antes esto leía p.tipo y p.observaciones, campos que no existen ni en
                    la tabla ni en el mapper: la pantalla pintaba "undefined". */}
                <div className="rh-data-row-detail">{ETIQUETA_CAUSA[p.causa] || "Sin causa"}</div>
                {p.motivo && <div className="rh-data-row-note">Motivo: {p.motivo}</div>}
                {p.comentario && <div className="rh-data-row-note">{p.comentario}</div>}
                {p.comentarioRH && (
                  <div className="rh-data-row-note">Comentario RH: {p.comentarioRH}</div>
                )}
              </div>

              <div className="rh-data-row-meta">
                <div className="rh-data-row-meta-primary">
                  {p.fechaFin && p.fechaFin !== p.fecha ? `${p.fecha} → ${p.fechaFin}` : p.fecha}
                </div>
                {p.hora && <div className="rh-data-row-meta-secondary">Sale a las {String(p.hora).slice(0, 5)}</div>}
                {descuentoDe(p) && (
                  <div className="rh-data-row-note rh-descuento">
                    Turno hasta las {descuentoDe(p).turno.horaSalida.slice(0, 5)} ·
                    {" "}<strong>descuento: {formatoDuracion(descuentoDe(p).min)}</strong>
                  </div>
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
