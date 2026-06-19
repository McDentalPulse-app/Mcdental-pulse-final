import React, { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";
import { USERS } from "../../data/initialData";
import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";

const EventosPersonal = ({ users }) => {
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
    return new Date(dateString).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long"
    });
  };

  const yearsSince = (dateString) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    return currentYear - date.getFullYear();
  };

  const eventos = [
    ...empleados.map(u => ({
      id: `cumple-${u.id}`,
      tipo: "Cumpleaños",
      icon: "🎂",
      empleado: u.name,
      puesto: u.puesto,
      sucursal: u.sucursal,
      fechaBase: u.fechaNacimiento,
      fechaTexto: formatDate(u.fechaNacimiento),
      dias: daysUntil(u.fechaNacimiento),
      detalle: "Cumpleaños del colaborador"
    })),
    ...empleados.map(u => ({
      id: `aniv-${u.id}`,
      tipo: "Aniversario laboral",
      icon: "🎉",
      empleado: u.name,
      puesto: u.puesto,
      sucursal: u.sucursal,
      fechaBase: u.fechaIngreso,
      fechaTexto: formatDate(u.fechaIngreso),
      dias: daysUntil(u.fechaIngreso),
      detalle: `${yearsSince(u.fechaIngreso)} año(s) en McDental`
    }))
  ]
    .filter(e => e.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  const hoy = eventos.filter(e => e.dias === 0).length;
  const proximos3 = eventos.filter(e => e.dias > 0 && e.dias <= 3).length;
  const proximos7 = eventos.filter(e => e.dias > 0 && e.dias <= 7).length;

  const badgeStyle = (dias) => ({
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background:
      dias === 0 ? "#fee2e2" :
      dias <= 3 ? "#ffedd5" :
      dias <= 7 ? "#fef3c7" :
      "#dcfce7",
    color:
      dias === 0 ? "#991b1b" :
      dias <= 3 ? "#c2410c" :
      dias <= 7 ? "#92400e" :
      "#166534"
  });

  const textoDias = (dias) => {
    if (dias === 0) return "Hoy";
    if (dias === 1) return "Mañana";
    return `En ${dias} días`;
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Cumpleaños y Aniversarios
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Recordatorios automáticos de cumpleaños y aniversarios laborales del equipo.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>🎂</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#ef4444" }}>
            {hoy}
          </div>
          <div style={{ fontWeight: 800 }}>Eventos hoy</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>⏰</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#f97316" }}>
            {proximos3}
          </div>
          <div style={{ fontWeight: 800 }}>Próximos 3 días</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>📅</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#f59e0b" }}>
            {proximos7}
          </div>
          <div style={{ fontWeight: 800 }}>Próximos 7 días</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>🎉</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#00897B" }}>
            {eventos.length}
          </div>
          <div style={{ fontWeight: 800 }}>Próximos 30 días</div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>
          🎁 Agenda de celebraciones
        </h3>

        {eventos.length === 0 ? (
          <p style={{ color: "#64748b" }}>
            No hay cumpleaños ni aniversarios próximos en los siguientes 30 días.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {eventos.map(e => (
              <div
                key={e.id}
                style={{
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  background: "#f8fafc",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 17 }}>
                    {e.icon} {e.empleado}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {e.sucursal} · {e.puesto}
                  </div>
                  <div style={{ color: "#334155", marginTop: 6 }}>
                    <b>{e.tipo}</b> · {e.fechaTexto}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {e.detalle}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={badgeStyle(e.dias)}>
                    {textoDias(e.dias)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};


export default EventosPersonal;
