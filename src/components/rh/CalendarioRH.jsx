import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";

const tipoPillClass = (tipo) => {
  if (tipo === "Vacaciones") return "mc-status-pill--vacaciones";
  if (tipo === "Permiso") return "mc-status-pill--permiso";
  return "mc-status-pill--festivo";
};

const CalendarioRH = ({ vacaciones, permisos, eventosExtra }) => {
  const eventos = [
    ...vacaciones.map(v => ({
      id: `vac-${v.id}`,
      fecha: v.inicio,
      fechaFin: v.fin,
      tipo: "Vacaciones",
      titulo: `${v.empleado} - Vacaciones`,
      detalle: `${v.dias} días · ${v.estado}`,
      sucursal: v.sucursal,
      estado: v.estado,
      icon: "vacation"
    })),
    ...permisos.map(p => ({
      id: `perm-${p.id}`,
      fecha: p.fecha,
      tipo: "Permiso",
      titulo: `${p.empleado} - ${p.tipo}`,
      detalle: `${p.hora} · ${p.estado}`,
      sucursal: p.sucursal,
      estado: p.estado,
      icon: "clipboard"
    })),
    ...eventosExtra.map(e => ({
      id: `extra-${e.id}`,
      fecha: e.fecha,
      tipo: e.tipo,
      titulo: e.titulo,
      detalle: `${e.area} · ${e.estado}`,
      sucursal: e.sucursal,
      estado: e.estado,
      icon: e.tipo === "Festivo" ? "party" : e.tipo === "Asueto" ? "vacation" : "pin"
    }))
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const resumen = {
    vacaciones: eventos.filter(e => e.tipo === "Vacaciones").length,
    permisos: eventos.filter(e => e.tipo === "Permiso").length,
    extra: eventos.filter(e => ["Festivo", "Asueto", "Evento"].includes(e.tipo)).length
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Calendario General</h1>
        <p className="admin-page-subtitle">
          Vista general de vacaciones, permisos, festivos y asuetos.
        </p>
      </div>

      <div className="admin-stat-grid">
        <StatCard iconName="vacation" value={resumen.vacaciones} label="Vacaciones" valueClass="admin-stat-value--blue" />
        <StatCard iconName="clipboard" value={resumen.permisos} label="Permisos" valueClass="admin-stat-value--amber" />
        <StatCard iconName="party" value={resumen.extra} label="Festivos / Asuetos" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="calendar">Agenda laboral</SectionTitle>

        <div className="rh-calendar-list">
          {eventos.map(e => (
            <div key={e.id} className="rh-calendar-row">
              <div className="rh-calendar-date">
                {e.fecha}
                {e.fechaFin && e.fechaFin !== e.fecha ? (
                  <span className="rh-calendar-date-end">al {e.fechaFin}</span>
                ) : null}
              </div>

              <div className="rh-calendar-body">
                <div className="rh-calendar-title">
                  <Icon name={e.icon} size={16} /> {e.titulo}
                </div>
                <div className="rh-calendar-detail">{normalizeSucursal(e.sucursal)} · {e.detalle}</div>
              </div>

              <div className="rh-calendar-badge">
                <span className={`mc-status-pill ${tipoPillClass(e.tipo)}`}>{e.tipo}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default CalendarioRH;
