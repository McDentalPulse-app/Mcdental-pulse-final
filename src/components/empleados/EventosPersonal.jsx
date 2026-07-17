import React from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import StatCard from "../common/StatCard";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import CalendarioMensual from "../common/CalendarioMensual";
import { normalizeSucursal } from "../../utils/constants";

const pad2 = (n) => String(n).padStart(2, "0");
// Cumpleaños y aniversarios recurren cada año: se ubican en la fecha de ESTE año para el
// calendario. Las fechas llegan como STRING: cumpleaños en "MM-DD" y el ingreso en "YYYY-MM-DD"
// (o legacy completo). Se extrae mes/día sin asumir que es un objeto Date.
const fechaEsteAnio = (str) => {
  if (!str) return null;
  const partes = String(str).trim().split(/[-/]/).map((p) => Number(p.trim()));
  let mm;
  let dd;
  if (partes.length === 2) [mm, dd] = partes;            // "MM-DD"
  else if (partes.length === 3) [, mm, dd] = partes;     // "YYYY-MM-DD"
  else return null;
  if (!mm || !dd || mm > 12 || dd > 31) return null;
  return `${new Date().getFullYear()}-${pad2(mm)}-${pad2(dd)}`;
};
import {
  daysUntilCumpleanos,
  daysUntilDate,
  formatFechaCumpleanos,
  formatFechaIngreso,
  resolveFechaCumpleanos,
  resolveFechaIngreso,
  yearsSinceIngreso,
} from "../../utils/helpers";

const EventosPersonal = ({ users }) => {
  const empleados = users.filter(u => ["empleado", "rh", "psicologa", "admin"].includes(u.role) && !u.inactivo);

  const eventos = [
    ...empleados.map(u => {
      const cumple = resolveFechaCumpleanos(u);
      return {
        id: `cumple-${u.id}`,
        tipo: "Cumpleaños",
        icon: "cake",
        empleado: u.name,
        puesto: u.puesto,
        sucursal: normalizeSucursal(u.sucursal),
        fechaTexto: formatFechaCumpleanos(cumple),
        dias: daysUntilCumpleanos(cumple),
        detalle: "Cumpleaños del colaborador",
      };
    }),
    ...empleados.map(u => {
      const ingreso = resolveFechaIngreso(u);
      return {
        id: `aniv-${u.id}`,
        tipo: "Aniversario laboral",
        icon: "party",
        empleado: u.name,
        puesto: u.puesto,
        sucursal: normalizeSucursal(u.sucursal),
        fechaTexto: formatFechaIngreso(ingreso),
        dias: daysUntilDate(ingreso),
        detalle: ingreso ? `${yearsSinceIngreso(ingreso)} año(s) en McDental` : "Sin fecha de ingreso",
      };
    }),
  ]
    .filter(e => e.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  // Todos los cumpleaños/aniversarios del equipo, ubicados en el calendario de este año.
  const eventosCal = [
    ...empleados.map(u => { const f = fechaEsteAnio(resolveFechaCumpleanos(u)); return f && { fecha: f, titulo: `🎂 ${u.name}`, detalle: "Cumpleaños", color: "rojo" }; }),
    ...empleados.map(u => { const f = fechaEsteAnio(resolveFechaIngreso(u)); return f && { fecha: f, titulo: `🎉 ${u.name}`, detalle: "Aniversario", color: "azul" }; }),
  ].filter(Boolean);

  const proximo = eventos[0] || null;

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
    <div className="admin-page eventos-personal-page">
      <PageHeader
        icon="cake"
        title="Cumpleaños y Aniversarios"
        subtitle="Recordatorios automáticos de cumpleaños y aniversarios laborales del equipo."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="cake" value={hoy} label="Eventos hoy" valueClass="admin-stat-value--red" />
        <StatCard iconName="clock" value={proximos3} label="Próximos 3 días" valueClass="admin-stat-value--orange" />
        <StatCard iconName="calendar" value={proximos7} label="Próximos 7 días" valueClass="admin-stat-value--amber" />
        <StatCard iconName="party" value={eventos.length} label="Próximos 30 días" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="calendarDays">Calendario</SectionTitle>
        <CalendarioMensual eventos={eventosCal} />
      </Card>

      {proximo && (
        <Card className="eventos-proximo">
          <div className="eventos-proximo-label">
            <Icon name={proximo.icon} size={16} /> Próximo
          </div>
          <div className="eventos-proximo-main">
            <strong>{proximo.empleado}</strong>
            <span>{proximo.tipo} · {proximo.fechaTexto}</span>
          </div>
          <span className={pillClass(proximo.dias)}>{textoDias(proximo.dias)}</span>
        </Card>
      )}

      <Card>
        <SectionTitle icon="gift">Agenda de celebraciones</SectionTitle>
        {eventos.length === 0 ? (
          <p className="admin-empty">No hay cumpleaños ni aniversarios próximos en los siguientes 30 días.</p>
        ) : (
          <div className="admin-list-scroll admin-list-scroll--tall">
            {eventos.map(e => (
              <div key={e.id} className="admin-list-item eventos-list-item">
                <div>
                  <div className="admin-list-item-title eventos-list-item-title">
                    <Icon name={e.icon} size={16} /> {e.empleado}
                  </div>
                  <div className="admin-list-item-meta">{normalizeSucursal(e.sucursal)} · {e.puesto}</div>
                  <div className="admin-list-item-body eventos-list-item-body">
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
