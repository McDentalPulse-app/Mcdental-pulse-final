import React from "react";
import Card from "../common/Card";

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
      icon: "🏖️"
    })),
    ...permisos.map(p => ({
      id: `perm-${p.id}`,
      fecha: p.fecha,
      tipo: "Permiso",
      titulo: `${p.empleado} - ${p.tipo}`,
      detalle: `${p.hora} · ${p.estado}`,
      sucursal: p.sucursal,
      estado: p.estado,
      icon: "📝"
    })),
    ...eventosExtra.map(e => ({
      id: `extra-${e.id}`,
      fecha: e.fecha,
      tipo: e.tipo,
      titulo: e.titulo,
      detalle: `${e.area} · ${e.estado}`,
      sucursal: e.sucursal,
      estado: e.estado,
      icon: e.tipo === "Festivo" ? "🎉" : e.tipo === "Asueto" ? "🌴" : "📌"
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

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>🏖️</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#0891b2" }}>{resumen.vacaciones}</div>
          <div style={{ fontWeight: 700 }}>Vacaciones</div>
        </Card>
        <Card>
          <div style={{ fontSize: 24 }}>📝</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f59e0b" }}>{resumen.permisos}</div>
          <div style={{ fontWeight: 700 }}>Permisos</div>
        </Card>
        <Card>
          <div style={{ fontSize: 24 }}>🎉</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#22c55e" }}>{resumen.extra}</div>
          <div style={{ fontWeight: 700 }}>Festivos / Asuetos</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>📅 Agenda laboral</h3>

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
                <div style={{ fontWeight: 800, color: "#0f172a" }}>
                  {e.icon} {e.titulo}
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
