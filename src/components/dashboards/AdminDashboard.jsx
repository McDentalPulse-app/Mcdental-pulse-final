import React from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import MiniBar from "../common/MiniBar";
import LineChart from "../common/LineChart";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import SectionTitle from "../common/SectionTitle";
import { SUCURSALES } from "../../utils/constants";
import { calcPulseScore, getPulseStatus } from "../../utils/pulseScore";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { semanaActual } from "../../utils/constants";

const abbrevSucursal = (name) => {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (name.length <= 14) return name;
  if (parts.length >= 2) {
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") + ".";
  }
  return `${name.slice(0, 10)}…`;
};

const AdminDashboard = ({ encuestas, mensajes }) => {
  const { usuarios: USERS } = useGlobal();

  const empleados = USERS.filter(u => u.role === "empleado");
  const semanaEnc = encuestas.filter(e => e.semana === semanaActual);
  const contestaron = new Set(semanaEnc.map(e => e.empleadoId)).size;

  const pulsePorEmpleado = empleados.map(emp => {
    const pulse = calcPulseScore(emp.id, encuestas);
    return {
      empleado: emp,
      score: pulse.score,
      sinDatos: pulse.sinDatos,
      pulse,
      status: pulse.sinDatos
        ? { label: "Sin datos", semaforo: "Sin datos", color: "#94a3b8", bg: "#f1f5f9" }
        : getPulseStatus(pulse.score)
    };
  });

  const empleadosConDatos = pulsePorEmpleado.filter(
    e => !e.sinDatos && Number.isFinite(Number(e.score))
  );

  const verdes = empleadosConDatos.filter(e => e.status.semaforo === "Verde").length;
  const amarillos = empleadosConDatos.filter(e => e.status.semaforo === "Amarillo").length;
  const rojos = empleadosConDatos.filter(e => e.status.semaforo === "Rojo").length;

  const tendencia = ["W10", "W11", "W12", "W13", "W14"].map((w) => {
    const encValidas = encuestas.filter(
      (e) => e.semana === `2025-${w}` && Number.isFinite(Number(e.score))
    );
    const hasData = encValidas.length > 0;
    return {
      label: w,
      hasData,
      v: hasData
        ? Math.round(encValidas.reduce((s, e) => s + Number(e.score), 0) / encValidas.length)
        : null,
    };
  });

  const semanasConScore = tendencia.filter((t) => t.hasData && Number.isFinite(t.v));
  const tieneHistorialSuficiente = semanasConScore.length >= 2;
  const datosTendencia = semanasConScore.map(({ label, v }) => ({ label, v }));

  const porSucursal = SUCURSALES.map((s) => {
    const emps = empleados.filter((e) => e.sucursal === s).map((e) => e.id);
    const encValidas = semanaEnc.filter(
      (e) => emps.includes(e.empleadoId) && Number.isFinite(Number(e.score))
    );
    const hasData = encValidas.length > 0;
    return {
      label: s,
      shortLabel: abbrevSucursal(s),
      hasData,
      v: hasData
        ? Math.round(encValidas.reduce((sum, e) => sum + Number(e.score), 0) / encValidas.length)
        : null,
    };
  });

  const avgPulse = empleadosConDatos.length
    ? Math.round(
        empleadosConDatos.reduce((s,e)=>s+Number(e.score),0) /
        empleadosConDatos.length
      )
    : null;

  const avgPulseStatus = avgPulse === null
    ? { label: "Sin datos", semaforo: "Sin datos", color: "#94a3b8", bg: "#f1f5f9" }
    : getPulseStatus(avgPulse);

  const enFocoRojo = empleadosConDatos.filter(e => e.status.semaforo === "Rojo");
  const participacion = empleados.length
    ? Math.round((contestaron / empleados.length) * 100)
    : 0;

  return (
    <div className="admin-page dashboard-page">
      <header className="dashboard-executive-header">
        <div className="dashboard-executive-main">
          <span className="dashboard-eyebrow">McDental Pulse · Administración</span>
          <h1 className="dashboard-title">Dashboard Global</h1>
          <p className="dashboard-subtitle">
            Visión ejecutiva del bienestar organizacional · {empleados.length} colaboradores activos
          </p>
        </div>
        <div className="dashboard-executive-meta">
          <span className="dashboard-week-badge">
            <Icon name="calendar" size={14} />
            Semana {semanaActual}
          </span>
          <span className="dashboard-participation-badge">
            <Icon name="clipboardCheck" size={14} />
            {participacion}% participación
          </span>
        </div>
      </header>

      <div className="dashboard-metrics">
        <div className="dashboard-kpi-grid">
          <KPI iconName="users" label="Empleados" value={empleados.length} color="#2D6A5F" />
          <KPI iconName="check" label="Contestaron" value={contestaron} sub={`de ${empleados.length}`} color="#3D8B7E" />
          <KPI iconName="stable" label="Verde" value={verdes} color="#2F7D5A" />
          <KPI iconName="warning" label="Amarillo" value={amarillos} color="#9A6B1F" />
          <KPI iconName="critical" label="Rojo" value={rojos} color="#A84444" />
        </div>

        <Card className="pulse-hero-card dashboard-pulse-feature">
          <div className="pulse-hero-top">
            <div className="pulse-hero-icon-wrap">
              <Icon name="activity" size={22} color="#fff" />
            </div>
            <div className="pulse-hero-label">Pulse Score™</div>
          </div>
          <div className="pulse-hero-value">{avgPulse ?? "—"}</div>
          <div className="pulse-hero-meta">
            <span className="pulse-hero-status" style={{ color: avgPulseStatus.color }}>
              {avgPulseStatus.label}
            </span>
            <span className="pulse-hero-dot">·</span>
            <span>Semáforo {avgPulseStatus.semaforo}</span>
          </div>
          <div className="pulse-hero-sub">Promedio organizacional del periodo</div>
        </Card>
      </div>

      <div className="dashboard-grid-2">
        <Card className="dashboard-chart-card">
          <SectionTitle icon="trending">Tendencia Semanal</SectionTitle>
          {tieneHistorialSuficiente ? (
            <LineChart data={datosTendencia} color="#2D6A5F" height={128} />
          ) : (
            <div className="dashboard-trend-empty">
              <div className="dashboard-trend-empty-icon">
                <Icon name="trending" size={22} />
              </div>
              <p className="dashboard-trend-empty-text">
                Aún no hay historial suficiente para calcular la evolución semanal.
              </p>
              <p className="dashboard-trend-empty-sub">
                La tendencia se activará conforme se registren nuevas encuestas.
              </p>
            </div>
          )}
        </Card>
        <Card className="dashboard-chart-card">
          <SectionTitle icon="building">Score por Sucursal</SectionTitle>
          <p className="dashboard-chart-hint">Pase el cursor sobre cada barra para ver la sucursal completa.</p>
          <MiniBar
            data={porSucursal}
            labelKey="shortLabel"
            colorFn={(d) => {
              const val = d.value ?? d.v ?? 0;
              if (val >= 70) return "#2F7D5A";
              if (val >= 45) return "#9A6B1F";
              return "#A84444";
            }}
          />
        </Card>
      </div>

      <Card className={`dashboard-foco-card${enFocoRojo.length ? " dashboard-foco-card--active" : ""}`}>
        <div className="dashboard-foco-header">
          <SectionTitle icon="alert" className="dashboard-foco-title">
            Empleados en Foco Rojo
          </SectionTitle>
          <span className={`dashboard-foco-count${enFocoRojo.length ? " dashboard-foco-count--alert" : ""}`}>
            {enFocoRojo.length}
          </span>
        </div>
        {enFocoRojo.length === 0 ? (
          <div className="dashboard-empty dashboard-empty--ok">
            <Icon name="check" size={18} />
            Sin empleados en foco rojo esta semana
          </div>
        ) : (
          <div className="dashboard-foco-list">
            {enFocoRojo.map(e => {
              const emp = e.empleado;
              const ps = e.pulse;
              return (
                <div key={emp.id} className="dashboard-employee-row dashboard-employee-row--alert">
                  <Avatar name={emp.name} size={40} color="#A84444" />
                  <div className="dashboard-employee-info">
                    <div className="dashboard-employee-name">{emp.name}</div>
                    <div className="dashboard-employee-meta">{emp.sucursal} · {emp.puesto}</div>
                  </div>
                  <Badge tipo="rojo" />
                  <PulseScoreBadge score={ps.score} nivel={ps.nivel} color={ps.color} tendencia={ps.tendencia} size="sm" />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminDashboard;
