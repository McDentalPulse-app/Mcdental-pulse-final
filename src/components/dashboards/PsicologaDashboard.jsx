import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useAuth } from "../../contexts/AuthContext";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Badge from "../common/Badge";
import Icon from "../ui/Icon";
import GroupedBarChart from "../common/GroupedBarChart";
import { semanaDisplay, normalizeSucursal, isSemanaActual, formatSemanaDisplay } from "../../utils/constants";
import { calcPulseScore, getPulseStatus } from "../../utils/pulseScore";

const SEMAFORO_META = {
  verde: { label: "Estable", color: "#22c55e" },
  amarillo: { label: "Atención", color: "#f59e0b" },
  rojo: { label: "Foco rojo", color: "#ef4444" },
  "sin-datos": { label: "Sin datos", color: "#94a3b8" },
};

const PsicologaDashboard = ({ encuestas, mensajes, reportesConfidenciales = [] }) => {
  const { usuarios: USERS } = useGlobal();
  const { user } = useAuth();
  const empleados = USERS.filter(u => u.role === "empleado");

  // Estado por empleado: una sola fuente de verdad (Pulse Score → semáforo).
  const estados = empleados.map(emp => {
    const ps = calcPulseScore(emp.id, encuestas);
    const nivel = ps.sinDatos ? "sin-datos" : getPulseStatus(ps.score).nivel;
    return { emp, ps, nivel };
  });

  const semanaEnc = encuestas.filter(e => isSemanaActual(e.semana));
  const contestaron = new Set(semanaEnc.map(e => e.empleadoId)).size;
  const pendientes = empleados.length - contestaron;
  const participacion = empleados.length ? Math.round((contestaron / empleados.length) * 100) : 0;

  // Distribución de semáforo (cuenta empleados, no filas de encuesta).
  const dist = { verde: 0, amarillo: 0, rojo: 0, "sin-datos": 0 };
  estados.forEach(e => { dist[e.nivel] += 1; });
  const focoRojo = dist.rojo;
  const conDatos = empleados.length - dist["sin-datos"];

  const reportesNuevos = reportesConfidenciales.filter(r => r.estado === "nuevo").length;
  const mensajesNoLeidos = mensajes.filter(m => m.para === user?.id && !m.leido).length;

  // Tendencia del bienestar por oficina: Pulse Score promedio por sucursal y semana.
  const TREND_COLORS = ["#0E8C7A", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#65a30d"];
  const empSucursal = {};
  USERS.forEach(u => { empSucursal[u.id] = normalizeSucursal(u.sucursal) || "Sin sucursal"; });

  const officeWeek = {};
  const semanasSet = new Set();
  encuestas.forEach(e => {
    const s = Number(e.score);
    if (!Number.isFinite(s)) return;
    const suc = empSucursal[e.empleadoId];
    if (!suc) return; // encuesta huérfana: empleadoId ya no existe en usuarios
    semanasSet.add(e.semana);
    (officeWeek[suc] ||= {});
    (officeWeek[suc][e.semana] ||= []).push(s);
  });
  const semanas = [...semanasSet].sort((a, b) => String(a).localeCompare(String(b))).slice(-6);
  const trendLabels = semanas.map(w => formatSemanaDisplay(w));
  const trendSeries = Object.keys(officeWeek)
    .filter(suc => semanas.some(w => officeWeek[suc][w]))
    .map((suc, i) => ({
      label: suc,
      color: TREND_COLORS[i % TREND_COLORS.length],
      values: semanas.map(w => {
        const arr = officeWeek[suc][w];
        return arr ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
      }),
    }))
    .slice(0, 8);
  const trendHayDatos = semanas.length >= 2 && trendSeries.length > 0;

  // Sucursales con más casos en riesgo (amarillo/rojo) + sus empleados.
  const sucMap = {};
  estados.forEach(s => {
    const suc = normalizeSucursal(s.emp.sucursal) || "Sin sucursal";
    (sucMap[suc] ||= { suc, total: 0, riesgo: 0, emps: [] });
    sucMap[suc].total += 1;
    if (s.nivel === "rojo" || s.nivel === "amarillo") {
      sucMap[suc].riesgo += 1;
      sucMap[suc].emps.push(s);
    }
  });
  const sucursalesRiesgo = Object.values(sucMap)
    .filter(x => x.riesgo > 0)
    .sort((a, b) => b.riesgo - a.riesgo)
    .slice(0, 5);
  sucursalesRiesgo.forEach(s => s.emps.sort((a, b) => (a.nivel === "rojo" ? 0 : 1) - (b.nivel === "rojo" ? 0 : 1)));

  const [sucursalDetalle, setSucursalDetalle] = useState(null);

  const casosPrioritarios = estados
    .filter(e => e.nivel === "rojo" || e.nivel === "amarillo")
    .sort((a, b) => (a.nivel === "rojo" ? -1 : 1) - (b.nivel === "rojo" ? -1 : 1))
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
            Semana {semanaDisplay}
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

      <div className="admin-grid-2 psico-dash-grid">
        {/* Distribución de semáforo */}
        <Card>
          <SectionTitle icon="activity">Distribución del equipo</SectionTitle>
          {conDatos === 0 ? (
            <p className="admin-empty">Aún no hay encuestas para evaluar el semáforo.</p>
          ) : (
            <>
              <div className="psico-dist-bar" role="img" aria-label="Distribución de semáforo del equipo">
                {["verde", "amarillo", "rojo", "sin-datos"].map(k =>
                  dist[k] > 0 ? (
                    <div
                      key={k}
                      className="psico-dist-seg"
                      style={{ flexGrow: dist[k], background: SEMAFORO_META[k].color }}
                      title={`${SEMAFORO_META[k].label}: ${dist[k]}`}
                    />
                  ) : null
                )}
              </div>
              <div className="psico-dist-legend">
                {["verde", "amarillo", "rojo", "sin-datos"].map(k => (
                  <div key={k} className="psico-dist-item">
                    <span className="psico-dist-dot" style={{ background: SEMAFORO_META[k].color }} />
                    <span className="psico-dist-label">{SEMAFORO_META[k].label}</span>
                    <span className="psico-dist-count">{dist[k]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Participación semanal */}
        <Card>
          <SectionTitle icon="clipboardCheck">Participación · Semana {semanaDisplay}</SectionTitle>
          <div className="psico-part">
            <div className="psico-part-ring" style={{ "--pct": participacion }}>
              <span className="psico-part-pct">{participacion}%</span>
            </div>
            <div className="psico-part-info">
              <div className="psico-part-row">
                <Icon name="clipboardCheck" size={15} />
                <strong>{contestaron}</strong> de {empleados.length} contestaron
              </div>
              <div className="psico-part-row psico-part-row--pending">
                <Icon name="clock" size={15} />
                <strong>{pendientes}</strong> pendientes esta semana
              </div>
              <div className="psico-part-track">
                <div className="psico-part-fill" style={{ width: `${participacion}%` }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tendencia del bienestar (ancho completo) */}
      <Card>
          <SectionTitle icon="trending">Tendencia del bienestar por oficina</SectionTitle>
          {!trendHayDatos ? (
            <p className="admin-empty">Se necesitan al menos 2 semanas con datos para la tendencia.</p>
          ) : (
            <>
              <GroupedBarChart labels={trendLabels} series={trendSeries} height={200} />
              <div className="psico-trend-legend">
                {trendSeries.map(s => (
                  <span key={s.label} className="psico-trend-legend-item">
                    <span className="psico-trend-dot" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
              <p className="psico-chart-foot">Pulse Score promedio por sucursal y semana.</p>
            </>
          )}
        </Card>

      {/* Sucursales en riesgo (ancho completo) */}
      <Card>
          <SectionTitle icon="alert">Sucursales en riesgo</SectionTitle>
          {sucursalesRiesgo.length === 0 ? (
            <p className="admin-empty">Ninguna sucursal con casos en amarillo o rojo.</p>
          ) : (
            <div className="psico-suc-list">
              {sucursalesRiesgo.map((s) => (
                <button
                  key={s.suc}
                  type="button"
                  className="psico-suc-row psico-suc-row--clickable"
                  title={`${s.riesgo} en riesgo: ${s.emps.map(e => e.emp.name.split(" ")[0]).join(", ")}`}
                  onClick={() => setSucursalDetalle(s)}
                >
                  <div className="psico-suc-head">
                    <span className="psico-suc-name">{s.suc}</span>
                    <span className="psico-suc-count">{s.riesgo}/{s.total} <Icon name="eye" size={13} /></span>
                  </div>
                  <div className="psico-suc-track">
                    <div
                      className="psico-suc-fill"
                      style={{ width: `${Math.round((s.riesgo / s.total) * 100)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
      </Card>

      <Card>
        <SectionTitle icon="target">Casos prioritarios</SectionTitle>
        {casosPrioritarios.length === 0 ? (
          <p className="admin-empty">No hay casos en amarillo o rojo.</p>
        ) : (
          <div className="psico-priority-grid">
            {casosPrioritarios.map(({ emp, ps, nivel }) => (
              <div key={emp.id} className={`psico-priority-card psico-priority-card--${nivel}`}>
                <div className="psico-priority-top">
                  <div>
                    <div className="psico-priority-name">{emp.name}</div>
                    <div className="psico-priority-meta">{normalizeSucursal(emp.sucursal)} · {emp.puesto}</div>
                  </div>
                  <Badge tipo={nivel} />
                </div>
                <div className="psico-priority-foot">
                  <span className="psico-priority-stat">
                    <Icon name="activity" size={14} />
                    Score {Number.isFinite(Number(ps.score)) ? ps.score : "—"}
                  </span>
                  <span className="psico-priority-stat">
                    <Icon name="trending" size={14} />
                    Tendencia {ps.tendencia}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {sucursalDetalle && (
        <div className="mc-modal-overlay" onClick={() => setSucursalDetalle(null)}>
          <div className="mc-modal psico-suc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="psico-suc-modal-head">
              <div>
                <h2 className="mc-modal-title">
                  <Icon name="building" size={18} /> {sucursalDetalle.suc}
                </h2>
                <p className="admin-page-subtitle psico-suc-modal-sub">
                  {sucursalDetalle.riesgo} de {sucursalDetalle.total} colaboradores en riesgo
                </p>
              </div>
              <button type="button" className="psico-detail-close" onClick={() => setSucursalDetalle(null)} aria-label="Cerrar">
                <Icon name="xCircle" size={20} />
              </button>
            </div>

            <div className="psico-suc-modal-list">
              {sucursalDetalle.emps.map(({ emp, ps, nivel }) => (
                <div key={emp.id} className={`psico-suc-emp psico-suc-emp--${nivel}`}>
                  <div className="psico-suc-emp-info">
                    <div className="psico-suc-emp-name">{emp.name}</div>
                    <div className="psico-suc-emp-meta">{emp.puesto}</div>
                  </div>
                  <div className="psico-suc-emp-right">
                    <span className="psico-suc-emp-score">Score {Number.isFinite(Number(ps.score)) ? ps.score : "—"} {ps.tendencia}</span>
                    <Badge tipo={nivel} />
                  </div>
                </div>
              ))}
            </div>

            <div className="psico-confidential-banner">
              <Icon name="lock" size={16} />
              Vista privada disponible únicamente para Psicóloga.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PsicologaDashboard;
