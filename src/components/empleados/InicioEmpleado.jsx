import React from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { semanaDisplay, normalizeSucursal, isSemanaActual, formatSemanaDisplay } from "../../utils/constants";
import { calcPulseScore, tieneScoreValido } from "../../utils/pulseScore";

const InicioEmpleado = ({ user, encuestas, mensajes, setActive }) => {
  const mis = encuestas.filter(e => e.empleadoId === user.id);
  const yaContesto = mis.some(e => isSemanaActual(e.semana));
  const ultimo = mis.sort((a, b) => b.semana.localeCompare(a.semana))[0];
  const noLeidos = mensajes.filter(m => m.para === user.id && !m.leido).length;
  const ps = calcPulseScore(user.id, encuestas);
  const tieneEvaluacion = !ps.sinDatos && tieneScoreValido(ps.score);

  const quickLinks = [
    {
      key: "encuesta",
      icon: yaContesto ? "check" : "clipboard",
      title: yaContesto ? "Encuesta completada" : "Encuesta pendiente",
      meta: `Semana ${semanaDisplay}`,
      variant: yaContesto ? "ok" : "pending",
      action: !yaContesto ? "Contestar ahora" : null,
      onClick: () => setActive("encuesta"),
    },
    {
      key: "vacaciones",
      icon: "vacation",
      title: "Vacaciones",
      meta: "Solicitar días de descanso",
      variant: "neutral",
      action: "Ver solicitudes",
      onClick: () => setActive("permisosempleado"),
    },
    {
      key: "mensajes",
      icon: "message",
      title: "Mensajes",
      meta: noLeidos > 0 ? `${noLeidos} sin leer` : "Canal con psicóloga",
      variant: noLeidos > 0 ? "alert" : "neutral",
      action: "Abrir mensajes",
      onClick: () => setActive("mensajes"),
    },
    {
      key: "reconocimientos",
      icon: "award",
      title: "Reconocimientos",
      meta: "Tus logros en McDental",
      variant: "neutral",
      action: "Ver historial",
      onClick: () => setActive("reconocimientos"),
    },
  ];

  return (
    <div className="admin-page empleado-page">
      <header className="empleado-welcome-header">
        <div>
          <span className="dashboard-eyebrow">McDental Pulse · Mi espacio</span>
          <h1 className="admin-page-title">Hola, {user.name.split(" ")[0]}</h1>
          <p className="admin-page-subtitle">{normalizeSucursal(user.sucursal)} · {user.puesto}</p>
        </div>
        <span className="dashboard-week-badge">
          <Icon name="calendar" size={14} /> Semana {semanaDisplay}
        </span>
      </header>

      <div className="empleado-quick-grid">
        {quickLinks.map((item) => (
          <div
            key={item.key}
            className={`mc-card empleado-quick-card empleado-quick-card--${item.variant}`}
            onClick={item.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && item.onClick()}
          >
            <div className="admin-stat-icon-wrap empleado-quick-icon">
              <Icon name={item.icon} size={20} />
            </div>
            <div className="empleado-quick-title">{item.title}</div>
            <div className="empleado-quick-meta">{item.meta}</div>
            {item.action && (
              <button
                type="button"
                className="mc-btn-primary mc-btn-with-icon empleado-quick-btn"
                onClick={(e) => { e.stopPropagation(); item.onClick(); }}
              >
                <Icon name="plus" size={14} /> {item.action}
              </button>
            )}
          </div>
        ))}
      </div>

      <Card className="empleado-pulse-card">
        <SectionTitle icon="activity">Mi bienestar</SectionTitle>
        {tieneEvaluacion ? (
          <div className="empleado-pulse-body">
            <PulseScoreBadge score={ps.score} nivel={ps.nivel} color={ps.color} tendencia={ps.tendencia} size="md" />
            {ultimo && <Badge tipo={ultimo.semaforo} />}
          </div>
        ) : (
          <div className="empleado-empty-inline">
            <Icon name="activity" size={18} />
            <span>Sin evaluación · completa tu encuesta semanal para ver tu Pulse Score.</span>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon="calendar">Mi historial reciente</SectionTitle>
        {mis.length === 0 ? (
          <p className="admin-empty">Aún no tienes encuestas registradas.</p>
        ) : (
          <div className="empleado-history-mini">
            {mis.sort((a, b) => b.semana.localeCompare(a.semana)).slice(0, 5).map(e => (
              <div key={e.id} className="empleado-history-row">
                <span className="empleado-history-week">
                  <Icon name="clipboard" size={14} /> {formatSemanaDisplay(e.semana)}
                </span>
                <Badge tipo={tieneScoreValido(e.score) ? e.semaforo : "amarillo"} />
                <span className="empleado-history-score">
                  {tieneScoreValido(e.score) ? e.score : "—"} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default InicioEmpleado;
