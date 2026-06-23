import React from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import StatCard from "../common/StatCard";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";

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
      id: `cumple-${u.id}`, tipo: "Cumpleaños", icon: "cake", empleado: u.name,
      puesto: u.puesto, sucursal: normalizeSucursal(u.sucursal), fechaTexto: formatDate(u.fechaNacimiento),
      dias: daysUntil(u.fechaNacimiento), detalle: "Cumpleaños del colaborador"
    })),
    ...empleados.map(u => ({
      id: `aniv-${u.id}`, tipo: "Aniversario laboral", icon: "party", empleado: u.name,
      puesto: u.puesto, sucursal: normalizeSucursal(u.sucursal), fechaTexto: formatDate(u.fechaIngreso),
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
        <StatCard iconName="cake" value={hoy} label="Eventos hoy" valueClass="admin-stat-value--red" />
        <StatCard iconName="clock" value={proximos3} label="Próximos 3 días" valueClass="admin-stat-value--orange" />
        <StatCard iconName="calendar" value={proximos7} label="Próximos 7 días" valueClass="admin-stat-value--amber" />
        <StatCard iconName="party" value={eventos.length} label="Próximos 30 días" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="gift">Agenda de celebraciones</SectionTitle>
        {eventos.length === 0 ? (
          <p className="admin-empty">No hay cumpleaños ni aniversarios próximos en los siguientes 30 días.</p>
        ) : (
          <div className="admin-list-scroll admin-list-scroll--tall">
            {eventos.map(e => (
              <div key={e.id} className="admin-list-item" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                <div>
                  <div className="admin-list-item-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name={e.icon} size={16} /> {e.empleado}
                  </div>
                  <div className="admin-list-item-meta">{normalizeSucursal(e.sucursal)} · {e.puesto}</div>
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
