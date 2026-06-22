import React from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Badge from "../common/Badge";
import Icon from "../ui/Icon";
import { semanaActual } from "../../utils/constants";

const PsicologaDashboard = ({ encuestas, mensajes, reportesConfidenciales = [] }) => {
  const { usuarios: USERS } = useGlobal();
  const empleados = USERS.filter(u => u.role === "empleado");
  const semanaEnc = encuestas.filter(e => e.semana === semanaActual);
  const contestaron = new Set(semanaEnc.map(e => e.empleadoId)).size;
  const pendientes = empleados.length - contestaron;
  const focoRojo = semanaEnc.filter(e => String(e.semaforo || "").toLowerCase() === "rojo").length;
  const reportesNuevos = reportesConfidenciales.filter(r => r.estado === "nuevo").length;
  const mensajesNoLeidos = mensajes.filter(m => !m.leido).length;

  const casosPrioritarios = empleados
    .map(emp => {
      const enc = encuestas
        .filter(e => e.empleadoId === emp.id)
        .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")));
      const ultima = enc[0];
      const sem = String(ultima?.semaforo || "verde").toLowerCase();
      return { emp, sem, score: ultima?.score, semana: ultima?.semana };
    })
    .filter(c => c.sem === "rojo" || c.sem === "amarillo")
    .slice(0, 6);

  const stats = [
    { label: "Colaboradores", value: empleados.length, iconName: "users", valueClass: "admin-stat-value--green" },
    { label: "Contestaron", value: contestaron, iconName: "clipboardCheck", valueClass: "admin-stat-value--blue" },
    { label: "Pendientes", value: pendientes, iconName: "clock", valueClass: "admin-stat-value--amber" },
    { label: "Foco rojo", value: focoRojo, iconName: "critical", valueClass: "admin-stat-value--red" },
  ];

  return (
    <div className="admin-page dashboard-page psico-dashboard">
      <header className="dashboard-executive-header">
        <div className="dashboard-executive-main">
          <span className="dashboard-eyebrow">McDental Pulse · Psicología Organizacional</span>
          <h1 className="dashboard-title">Dashboard Psicóloga</h1>
          <p className="dashboard-subtitle">
            Seguimiento clínico, bienestar emocional y casos prioritarios del equipo.
          </p>
        </div>
        <div className="dashboard-executive-meta">
          <span className="dashboard-week-badge">
            <Icon name="calendar" size={14} />
            Semana {semanaActual}
          </span>
          {reportesNuevos > 0 && (
            <span className="dashboard-participation-badge psico-meta-badge--conf">
              <Icon name="lock" size={14} />
              {reportesNuevos} reportes nuevos
            </span>
          )}
          {mensajesNoLeidos > 0 && (
            <span className="dashboard-participation-badge">
              <Icon name="message" size={14} />
              {mensajesNoLeidos} mensajes
            </span>
          )}
        </div>
      </header>

      <div className="admin-stat-grid">
        {stats.map((s, i) => (
          <StatCard key={i} iconName={s.iconName} value={s.value} label={s.label} valueClass={s.valueClass} />
        ))}
      </div>

      <Card>
        <SectionTitle icon="target">Casos prioritarios</SectionTitle>
        {casosPrioritarios.length === 0 ? (
          <p className="admin-empty">No hay casos en amarillo o rojo esta semana.</p>
        ) : (
          <div className="psico-priority-grid">
            {casosPrioritarios.map(({ emp, sem, score, semana }) => (
              <div key={emp.id} className={`psico-priority-card psico-priority-card--${sem}`}>
                <div className="psico-priority-top">
                  <div>
                    <div className="psico-priority-name">{emp.name}</div>
                    <div className="psico-priority-meta">{emp.sucursal} · {emp.puesto}</div>
                  </div>
                  <Badge tipo={sem} />
                </div>
                <div className="psico-priority-foot">
                  <span className="psico-priority-stat">
                    <Icon name="activity" size={14} />
                    Score {Number.isFinite(Number(score)) ? score : "—"}
                  </span>
                  <span className="psico-priority-stat">
                    <Icon name="calendar" size={14} />
                    {semana || "Sin registro"}
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

export default PsicologaDashboard;
