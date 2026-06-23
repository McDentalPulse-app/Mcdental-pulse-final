import React, { useMemo, useState } from "react";
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
  if (name.length <= 12) return name;
  if (parts.length >= 2) {
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") + ".";
  }
  return `${name.slice(0, 9)}…`;
};

const semaforoToBadge = (semaforo) => {
  if (semaforo === "Verde") return "verde";
  if (semaforo === "Amarillo") return "amarillo";
  if (semaforo === "Rojo") return "rojo";
  return null;
};

const buildSucursalDetalle = (nombreSucursal, empleados, encuestas, semanaEnc) => {
  const empsSucursal = empleados.filter((e) => e.sucursal === nombreSucursal);

  const filas = empsSucursal
    .map((emp) => {
      const pulse = calcPulseScore(emp.id, encuestas);
      const sinDatos = pulse.sinDatos || !Number.isFinite(Number(pulse.score));
      const contestoSemana = semanaEnc.some((e) => e.empleadoId === emp.id);
      const status = sinDatos
        ? { label: "Sin evaluación", semaforo: "Sin evaluación", color: "#94a3b8" }
        : getPulseStatus(pulse.score);

      return {
        empleado: emp,
        pulse,
        sinDatos,
        status,
        contestoSemana,
        sortScore: sinDatos ? 9999 : Number(pulse.score),
      };
    })
    .sort((a, b) => {
      if (a.sinDatos && !b.sinDatos) return 1;
      if (!a.sinDatos && b.sinDatos) return -1;
      return a.sortScore - b.sortScore;
    });

  const conScore = filas.filter((f) => !f.sinDatos);
  const promedio = conScore.length
    ? Math.round(conScore.reduce((s, f) => s + Number(f.pulse.score), 0) / conScore.length)
    : null;
  const promedioStatus =
    promedio == null
      ? { label: "Sin datos", semaforo: "Sin datos", color: "#94a3b8" }
      : getPulseStatus(promedio);

  return {
    nombre: nombreSucursal,
    total: empsSucursal.length,
    contestaron: filas.filter((f) => f.contestoSemana).length,
    promedio,
    promedioStatus,
    filas,
  };
};

const AdminDashboard = ({ encuestas, mensajes }) => {
  const { usuarios: USERS } = useGlobal();
  const [sucursalModal, setSucursalModal] = useState(null);

  const empleados = USERS.filter((u) => u.role === "empleado");
  const semanaEnc = encuestas.filter((e) => e.semana === semanaActual);
  const contestaron = new Set(semanaEnc.map((e) => e.empleadoId)).size;

  const pulsePorEmpleado = empleados.map((emp) => {
    const pulse = calcPulseScore(emp.id, encuestas);
    return {
      empleado: emp,
      score: pulse.score,
      sinDatos: pulse.sinDatos,
      pulse,
      status: pulse.sinDatos
        ? { label: "Sin datos", semaforo: "Sin datos", color: "#94a3b8", bg: "#f1f5f9" }
        : getPulseStatus(pulse.score),
    };
  });

  const empleadosConDatos = pulsePorEmpleado.filter(
    (e) => !e.sinDatos && Number.isFinite(Number(e.score))
  );

  const verdes = empleadosConDatos.filter((e) => e.status.semaforo === "Verde").length;
  const amarillos = empleadosConDatos.filter((e) => e.status.semaforo === "Amarillo").length;
  const rojos = empleadosConDatos.filter((e) => e.status.semaforo === "Rojo").length;

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

  const detalleSucursal = useMemo(() => {
    if (!sucursalModal) return null;
    return buildSucursalDetalle(sucursalModal, empleados, encuestas, semanaEnc);
  }, [sucursalModal, empleados, encuestas, semanaEnc]);

  const avgPulse = empleadosConDatos.length
    ? Math.round(
        empleadosConDatos.reduce((s, e) => s + Number(e.score), 0) / empleadosConDatos.length
      )
    : null;

  const avgPulseStatus =
    avgPulse === null
      ? { label: "Sin datos", semaforo: "Sin datos", color: "#94a3b8", bg: "#f1f5f9" }
      : getPulseStatus(avgPulse);

  const enFocoRojo = empleadosConDatos.filter((e) => e.status.semaforo === "Rojo");
  const participacion = empleados.length ? Math.round((contestaron / empleados.length) * 100) : 0;

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
        <Card className="dashboard-chart-card dashboard-chart-card--sucursal">
          <div className="dashboard-sucursal-card-head">
            <SectionTitle icon="building">Score por Sucursal</SectionTitle>
            <p className="dashboard-chart-hint dashboard-chart-hint--action">
              Haz clic en una sucursal para ver colaboradores.
            </p>
          </div>
          <div className="dashboard-sucursal-chart-shell">
            <MiniBar
              data={porSucursal}
              labelKey="shortLabel"
              interactive
              onBarClick={(d) => setSucursalModal(d.label)}
              colorFn={(d) => {
                const val = d.value ?? d.v ?? 0;
                if (val >= 70) return "#2F7D5A";
                if (val >= 45) return "#9A6B1F";
                return "#A84444";
              }}
            />
          </div>
        </Card>
      </div>

      {detalleSucursal && (
        <div
          className="mc-modal-overlay dashboard-sucursal-overlay"
          onClick={() => setSucursalModal(null)}
          role="presentation"
        >
          <div
            className="mc-modal dashboard-sucursal-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-sucursal-modal-title"
          >
            <div className="dashboard-sucursal-modal-head">
              <div>
                <h2 id="dashboard-sucursal-modal-title" className="dashboard-sucursal-modal-title">
                  {detalleSucursal.nombre}
                </h2>
                <p className="dashboard-sucursal-modal-sub">
                  Detalle de colaboradores y Pulse Score.
                </p>
              </div>
              <button
                type="button"
                className="dashboard-sucursal-modal-close"
                onClick={() => setSucursalModal(null)}
                aria-label="Cerrar"
              >
                <Icon name="xCircle" size={20} />
              </button>
            </div>

            <div className="dashboard-sucursal-kpis">
              <div className="dashboard-sucursal-kpi-card">
                <span className="dashboard-sucursal-kpi-label">Total colaboradores</span>
                <span className="dashboard-sucursal-kpi-value">{detalleSucursal.total}</span>
                <span className="dashboard-sucursal-kpi-sub">Registrados en sucursal</span>
              </div>
              <div className="dashboard-sucursal-kpi-card">
                <span className="dashboard-sucursal-kpi-label">Contestaron</span>
                <span className="dashboard-sucursal-kpi-value">{detalleSucursal.contestaron}</span>
                <span className="dashboard-sucursal-kpi-sub">Encuesta semana actual</span>
              </div>
              <div className="dashboard-sucursal-kpi-card">
                <span className="dashboard-sucursal-kpi-label">Promedio Pulse</span>
                <span
                  className="dashboard-sucursal-kpi-value"
                  style={{ color: detalleSucursal.promedioStatus.color }}
                >
                  {detalleSucursal.promedio ?? "Sin datos"}
                </span>
                <span className="dashboard-sucursal-kpi-sub">Bienestar promedio</span>
              </div>
              <div className="dashboard-sucursal-kpi-card">
                <span className="dashboard-sucursal-kpi-label">Semáforo promedio</span>
                <div className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--badge">
                  {detalleSucursal.promedio == null ? (
                    <span className="dashboard-sucursal-pill dashboard-sucursal-pill--muted">Sin datos</span>
                  ) : semaforoToBadge(detalleSucursal.promedioStatus.semaforo) ? (
                    <Badge tipo={semaforoToBadge(detalleSucursal.promedioStatus.semaforo)} />
                  ) : (
                    <span className="dashboard-sucursal-muted">{detalleSucursal.promedioStatus.label}</span>
                  )}
                </div>
                <span className="dashboard-sucursal-kpi-sub">Clasificación del equipo</span>
              </div>
            </div>

            <div className="dashboard-sucursal-list-wrap">
              <h3 className="dashboard-sucursal-list-title">Colaboradores de la sucursal</h3>
              {detalleSucursal.filas.length === 0 ? (
                <p className="dashboard-sucursal-empty">No hay colaboradores registrados en esta sucursal.</p>
              ) : (
                <div className="dashboard-sucursal-list">
                  {detalleSucursal.filas.map(({ empleado, pulse, sinDatos, status, contestoSemana }) => (
                    <div key={empleado.id} className="dashboard-sucursal-emp-row">
                      <Avatar name={empleado.name} size={42} color={sinDatos ? "#94a3b8" : pulse.color} />
                      <div className="dashboard-sucursal-emp-main">
                        <div className="dashboard-sucursal-emp-name">{empleado.name}</div>
                        <div className="dashboard-sucursal-emp-puesto">{empleado.puesto || "Sin puesto"}</div>
                      </div>
                      <div className="dashboard-sucursal-emp-aside">
                        <div className="dashboard-sucursal-emp-score">
                          {sinDatos ? (
                            <span className="dashboard-sucursal-muted">Sin datos</span>
                          ) : (
                            <>
                              <span className="dashboard-sucursal-emp-score-num" style={{ color: pulse.color }}>
                                {pulse.score}
                              </span>
                              <span className="dashboard-sucursal-emp-score-label">Pulse</span>
                            </>
                          )}
                        </div>
                        <div className="dashboard-sucursal-emp-badges">
                          {sinDatos ? (
                            <span className="dashboard-sucursal-pill dashboard-sucursal-pill--muted">
                              Sin evaluación
                            </span>
                          ) : semaforoToBadge(status.semaforo) ? (
                            <Badge tipo={semaforoToBadge(status.semaforo)} />
                          ) : (
                            <span className="dashboard-sucursal-pill dashboard-sucursal-pill--muted">
                              {status.label}
                            </span>
                          )}
                          <span
                            className={`dashboard-sucursal-pill dashboard-sucursal-pill--${contestoSemana ? "ok" : "pending"}`}
                          >
                            {contestoSemana ? "Completada" : "Pendiente"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-sucursal-modal-footer">
              <button type="button" className="mc-btn-secondary" onClick={() => setSucursalModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

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
            {enFocoRojo.map((e) => {
              const emp = e.empleado;
              const ps = e.pulse;
              return (
                <div key={emp.id} className="dashboard-employee-row dashboard-employee-row--alert">
                  <Avatar name={emp.name} size={40} color="#A84444" />
                  <div className="dashboard-employee-info">
                    <div className="dashboard-employee-name">{emp.name}</div>
                    <div className="dashboard-employee-meta">
                      {emp.sucursal} · {emp.puesto}
                    </div>
                  </div>
                  <Badge tipo="rojo" />
                  <PulseScoreBadge
                    score={ps.score}
                    nivel={ps.nivel}
                    color={ps.color}
                    tendencia={ps.tendencia}
                    size="sm"
                  />
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
