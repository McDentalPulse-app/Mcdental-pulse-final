import React from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";

const EventosPersonal = ({ users }) => {
  const { usuarios: USERS } = useGlobal();

  const empleados = users.filter(u => ["empleado", "rh", "psicologa", "admin"].includes(u.role));
  const today = new Date();
  const currentYear = today.getFullYear();

  const daysUntil = (dateString) => {
    if (!dateString) return 999;
    const original = new Date(dateString);
    let next = new Date(currentYear, original.getMonth(), original.getDate());
    if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      next = new Date(currentYear + 1, original.getMonth(), original.getDate());
    }
    const diff = next - new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Sin fecha";
    return new Date(dateString).toLocaleDateString("es-MX", { day: "2-digit", month: "long" });
  };

  const yearsSince = (dateString) => {
    if (!dateString) return 0;
    return currentYear - new Date(dateString).getFullYear();
  };

  const eventos = [
    ...empleados.map(u => ({
      id: `cumple-${u.id}`, tipo: "Cumpleaños", icon: "🎂", empleado: u.name,
      puesto: u.puesto, sucursal: u.sucursal, fechaTexto: formatDate(u.fechaNacimiento),
      dias: daysUntil(u.fechaNacimiento), detalle: "Cumpleaños del colaborador"
    })),
    ...empleados.map(u => ({
      id: `aniv-${u.id}`, tipo: "Aniversario laboral", icon: "🎉", empleado: u.name,
      puesto: u.puesto, sucursal: u.sucursal, fechaTexto: formatDate(u.fechaIngreso),
      dias: daysUntil(u.fechaIngreso), detalle: `${yearsSince(u.fechaIngreso)} año(s) en McDental`
    }))
  ].filter(e => e.dias <= 30).sort((a, b) => a.dias - b.dias);

  const hoy = eventos.filter(e => e.dias === 0).length;
  const proximos3 = eventos.filter(e => e.dias > 0 && e.dias <= 3).length;
  const proximos7 = eventos.filter(e => e.dias > 0 && e.dias <= 7).length;

  const pillClass = (dias) => {
    if (dias === 0) return "mc-status-pill mc-status-pill--today";
    if (dias <= 3) return "mc-status-pill mc-status-pill--soon3";
    if (dias <= 7) return "mc-status-pill mc-status-pill--soon7";
    return "mc-status-pill mc-status-pill--later";
  };

  const textoDias = (dias) => {
    if (dias === 0) return "Hoy";
    if (dias === 1) return "Mañana";
    return `En ${dias} días`;
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Cumpleaños y Aniversarios</h1>
        <p className="admin-page-subtitle">
          Recordatorios automáticos de cumpleaños y aniversarios laborales del equipo.
        </p>
      </div>

      <div className="admin-stat-grid">
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🎂</div>
          <div className="admin-stat-value admin-stat-value--red">{hoy}</div>
          <div className="admin-stat-label">Eventos hoy</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">⏰</div>
          <div className="admin-stat-value admin-stat-value--orange">{proximos3}</div>
          <div className="admin-stat-label">Próximos 3 días</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">📅</div>
          <div className="admin-stat-value admin-stat-value--amber">{proximos7}</div>
          <div className="admin-stat-label">Próximos 7 días</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon">🎉</div>
          <div className="admin-stat-value admin-stat-value--green">{eventos.length}</div>
          <div className="admin-stat-label">Próximos 30 días</div>
        </Card>
      </div>

      <Card>
        <h3 className="admin-section-title">🎁 Agenda de celebraciones</h3>
        {eventos.length === 0 ? (
          <p className="admin-empty">No hay cumpleaños ni aniversarios próximos en los siguientes 30 días.</p>
        ) : (
          <div className="admin-list-scroll admin-list-scroll--tall">
            {eventos.map(e => (
              <div key={e.id} className="admin-list-item" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                <div>
                  <div className="admin-list-item-title">{e.icon} {e.empleado}</div>
                  <div className="admin-list-item-meta">{e.sucursal} · {e.puesto}</div>
                  <div className="admin-list-item-body" style={{ marginTop: 6 }}>
                    <b>{e.tipo}</b> · {e.fechaTexto}
                  </div>
                  <div className="admin-list-item-meta">{e.detalle}</div>
                </div>
                <span className={pillClass(e.dias)}>{textoDias(e.dias)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default EventosPersonal;
