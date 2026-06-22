import React from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";

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

  const badgeStyle = (tipo) => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      tipo === "Vacaciones" ? "#ecfeff" :
      tipo === "Permiso" ? "#fef3c7" :
      "#fdcfe7",
    color:
      tipo === "Vacaciones" ? "#0e7490" :
      tipo === "Permiso" ? "#92400e" :
      "#166534"
  });

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Calendario General
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Vista general de vacaciones, permisos, festivos y asuetos.
      </p>

      <div className="admin-stat-grid">
        <StatCard iconName="vacation" value={resumen.vacaciones} label="Vacaciones" valueClass="admin-stat-value--blue" />
        <StatCard iconName="clipboard" value={resumen.permisos} label="Permisos" valueClass="admin-stat-value--amber" />
        <StatCard iconName="party" value={resumen.extra} label="Festivos / Asuetos" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="calendar">Agenda laboral</SectionTitle>

        <div style={{ display: "grid", gap: 10 }}>
          {eventos.map(e => (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr auto",
                gap: 14,
                alignItems: "center",
                padding: "14px 0",
                borderBottom: "1px solid #e5e7eb"
              }}
            >
              <div style={{ color: "#334155", fontWeight: 800 }}>
                {e.fecha}
                {e.fechaFin && e.fechaFin !== e.fecha ? (
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>al {e.fechaFin}</div>
                ) : null}
              </div>

              <div>
                <div style={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name={e.icon} size={16} /> {e.titulo}
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {e.sucursal} · {e.detalle}
                </div>
              </div>

              <div>
                <span style={badgeStyle(e.tipo)}>{e.tipo}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default CalendarioRH;
