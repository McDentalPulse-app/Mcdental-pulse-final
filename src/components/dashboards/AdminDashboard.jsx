import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import GroupedBarChart from "../common/GroupedBarChart";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import SectionTitle from "../common/SectionTitle";
import WeekSelect from "../common/WeekSelect";
import PageHeader from "../common/PageHeader";
import { SUCURSALES, semanaActual, normalizeSucursal, sucursalMatches, formatSemanaDisplay } from "../../utils/constants";
import { getPulseStatus, tieneScoreValido } from "../../utils/pulseScore";
import { nivelColor, nivelMeta, colorSerie } from "../../config/theme";
import PulseScoreBadge from "../common/PulseScoreBadge";
import "./AdminDashboard.css";
import { esEmpleadoActivo } from "../../utils/helpers";

// Variantes compartidas para la entrada/salida de modales (Motion library)
const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};
const modalMotion = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.97 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
};

// Igual que el dashboard de Psicóloga (mismos colores/etiquetas)
const semaforoToBadge = (semaforo) => {
  if (semaforo === "Verde") return "verde";
  if (semaforo === "Amarillo") return "amarillo";
  if (semaforo === "Rojo") return "rojo";
  return null;
};

const sucursalScoreColor = (val) => {
  if (val == null || !Number.isFinite(Number(val))) return "var(--mc-riskbar-track)";
  if (val >= 70) return "var(--mc-stat-green)";
  if (val >= 45) return "var(--mc-stat-amber)";
  return "var(--mc-stat-red)";
};

const buildSucursalDetalle = (nombreSucursal, empleados, encBucket) => {
  const empsSucursal = empleados.filter((e) => sucursalMatches(e.sucursal, nombreSucursal));

  const filas = empsSucursal
    .map((emp) => {
      const enc = encBucket(emp.id);
      const score = enc ? Math.round(Number(enc.score)) : null;
      const sinDatos = score == null;
      const contestoSemana = !!enc;
      const status = sinDatos
        ? { label: "Sin evaluación", semaforo: "Sin evaluación", color: "var(--mc-texto-secundario)" }
        : getPulseStatus(score);

      return {
        empleado: emp,
        score,
        color: sinDatos ? "var(--mc-texto-secundario)" : nivelColor(status.nivel),
        sinDatos,
        status,
        contestoSemana,
        sortScore: sinDatos ? 9999 : score,
      };
    })
    .sort((a, b) => {
      if (a.sinDatos && !b.sinDatos) return 1;
      if (!a.sinDatos && b.sinDatos) return -1;
      return a.sortScore - b.sortScore;
    });

  const conScore = filas.filter((f) => !f.sinDatos);
  const promedio = conScore.length
    ? Math.round(conScore.reduce((s, f) => s + Number(f.score), 0) / conScore.length)
    : null;
  const promedioStatus =
    promedio == null
      ? { label: "Sin datos", semaforo: "Sin datos", color: "var(--mc-texto-secundario)" }
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
  const [sucRiesgoModal, setSucRiesgoModal] = useState(null);

  const empleados = USERS.filter(esEmpleadoActivo);

  // Semanas como "buckets" (pre-lanzamiento juntas en "2026-W00"; lanzamiento+ "2026-W01"…).
  const semanasRaw = [...new Set(
    encuestas.filter((e) => tieneScoreValido(e.score)).map((e) => String(e.semana))
  )];
  const bucketWeeks = {};
  semanasRaw.forEach((w) => { (bucketWeeks[formatSemanaDisplay(w)] ||= []).push(w); });
  const labelActual = formatSemanaDisplay(semanaActual);
  const opcionesSemana = [...new Set([labelActual, ...Object.keys(bucketWeeks)])].sort((a, b) => b.localeCompare(a));
  const defaultWeek = bucketWeeks[labelActual] ? labelActual : (opcionesSemana.find((o) => bucketWeeks[o]) || labelActual);
  const [weekSel, setWeekSel] = useState(defaultWeek);
  const selRawWeeks = bucketWeeks[weekSel] || (weekSel === labelActual ? [semanaActual] : []);

  // Encuesta más reciente del empleado dentro del bucket; y score previo (tendencia).
  const encDelBucket = (empId) =>
    encuestas
      .filter((e) => e.empleadoId === empId && tieneScoreValido(e.score) && selRawWeeks.includes(String(e.semana)))
      .sort((a, b) => String(b.semana).localeCompare(String(a.semana)))[0];
  const scorePrevio = (empId) => {
    const minSel = [...selRawWeeks].sort()[0] || "";
    const prev = encuestas
      .filter((e) => e.empleadoId === empId && tieneScoreValido(e.score) && String(e.semana) < minSel)
      .sort((a, b) => String(b.semana).localeCompare(String(a.semana)))[0];
    return prev ? Math.round(Number(prev.score)) : null;
  };

  const pulsePorEmpleado = empleados.map((emp) => {
    const enc = encDelBucket(emp.id);
    const score = enc ? Math.round(Number(enc.score)) : null;
    const sinDatos = score == null;
    const status = sinDatos
      ? { label: "Sin datos", semaforo: "Sin datos", color: "var(--mc-texto-secundario)", bg: "var(--mc-gris-perla)" }
      : getPulseStatus(score);
    const prev = sinDatos ? null : scorePrevio(emp.id);
    const tendencia = prev == null ? "→" : score > prev ? "↑" : score < prev ? "↓" : "→";
    return {
      empleado: emp,
      score,
      sinDatos,
      status,
      pulse: { score, color: nivelColor(status.nivel), nivel: status.label, tendencia },
    };
  });

  const empleadosConDatos = pulsePorEmpleado.filter((e) => !e.sinDatos);
  const contestaron = empleadosConDatos.length;

  const verdes = empleadosConDatos.filter((e) => e.status.semaforo === "Verde").length;
  const amarillos = empleadosConDatos.filter((e) => e.status.semaforo === "Amarillo").length;
  const rojos = empleadosConDatos.filter((e) => e.status.semaforo === "Rojo").length;

  const porSucursal = SUCURSALES.map((s) => {
    const empsIds = empleados.filter((e) => sucursalMatches(e.sucursal, s)).map((e) => e.id);
    const scores = empsIds.map((id) => { const enc = encDelBucket(id); return enc ? Number(enc.score) : null; })
      .filter((v) => Number.isFinite(v));
    const hasData = scores.length > 0;
    return {
      label: s,
      hasData,
      v: hasData ? Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length) : null,
    };
  });

  const detalleSucursal = useMemo(() => {
    if (!sucursalModal) return null;
    return buildSucursalDetalle(sucursalModal, empleados, encDelBucket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucursalModal, weekSel, empleados, encuestas]);

  // Sucursales con más casos en riesgo (amarillo/rojo) en la semana seleccionada.
  const sucRiesgoMap = {};
  pulsePorEmpleado.forEach(({ empleado, status, sinDatos, score, pulse }) => {
    const suc = normalizeSucursal(empleado.sucursal) || "Sin sucursal";
    (sucRiesgoMap[suc] ||= { suc, total: 0, riesgo: 0, emps: [] });
    sucRiesgoMap[suc].total += 1;
    const nivel = sinDatos ? "sin-datos"
      : status.semaforo === "Rojo" ? "rojo"
      : status.semaforo === "Amarillo" ? "amarillo" : "verde";
    if (nivel === "rojo" || nivel === "amarillo") {
      sucRiesgoMap[suc].riesgo += 1;
      sucRiesgoMap[suc].emps.push({ emp: empleado, score, nivel, tendencia: pulse.tendencia });
    }
  });
  const sucursalesRiesgo = Object.values(sucRiesgoMap)
    .filter((x) => x.riesgo > 0)
    .sort((a, b) => b.riesgo - a.riesgo)
    .slice(0, 5);
  sucursalesRiesgo.forEach((s) => s.emps.sort((a, b) => (a.nivel === "rojo" ? 0 : 1) - (b.nivel === "rojo" ? 0 : 1)));

  const avgPulse = empleadosConDatos.length
    ? Math.round(
        empleadosConDatos.reduce((s, e) => s + Number(e.score), 0) / empleadosConDatos.length
      )
    : null;

  const avgPulseStatus =
    avgPulse === null
      ? { label: "Sin datos", semaforo: "Sin datos", color: "var(--mc-texto-secundario)", bg: "var(--mc-gris-perla)" }
      : getPulseStatus(avgPulse);

  const enFocoRojo = empleadosConDatos.filter((e) => e.status.semaforo === "Rojo");
  const participacion = empleados.length ? Math.round((contestaron / empleados.length) * 100) : 0;
  const pendientes = empleados.length - contestaron;

  // Distribución de semáforo del equipo (igual que Psicóloga)
  const dist = { verde: 0, amarillo: 0, rojo: 0, "sin-datos": 0 };
  pulsePorEmpleado.forEach(({ status, sinDatos }) => {
    const nivel = sinDatos ? "sin-datos" : status.nivel;
    if (nivel in dist) dist[nivel] += 1;
  });
  const conDatos = empleados.length - dist["sin-datos"];

  // Tendencia del bienestar por oficina: Pulse Score promedio por sucursal y semana.
  const empSucursal = {};
  USERS.forEach((u) => { empSucursal[u.id] = normalizeSucursal(u.sucursal) || "Sin sucursal"; });
  const officeWeek = {};
  const bucketSet = new Set();
  encuestas.forEach((e) => {
    const s = Number(e.score);
    if (!Number.isFinite(s)) return;
    const suc = empSucursal[e.empleadoId];
    if (!suc) return;
    const b = formatSemanaDisplay(String(e.semana));
    bucketSet.add(b);
    (officeWeek[suc] ||= {});
    (officeWeek[suc][b] ||= []).push(s);
  });
  const trendLabels = [...bucketSet].sort((a, b) => a.localeCompare(b)).slice(-6);
  const trendSeries = Object.keys(officeWeek)
    .filter((suc) => trendLabels.some((b) => officeWeek[suc][b]))
    .map((suc, i) => ({
      label: suc,
      color: colorSerie(i),
      values: trendLabels.map((b) => {
        const arr = officeWeek[suc][b];
        return arr ? Math.round(arr.reduce((a, c) => a + c, 0) / arr.length) : null;
      }),
    }))
    .slice(0, 8);
  const trendPorOficinaHayDatos = trendLabels.length >= 2 && trendSeries.length > 0;

  return (
    <div className="admin-page dashboard-page">
      <PageHeader
        icon="dashboard"
        eyebrow="McDental Pulse · Administración"
        title="Dashboard Global"
        subtitle={`Visión ejecutiva del bienestar organizacional · ${empleados.length} colaboradores activos`}
      >
        <WeekSelect
          value={weekSel}
          onChange={setWeekSel}
          options={opcionesSemana.map((w) => ({
            value: w,
            label: `${w}${w === labelActual ? " · actual" : ""}${w === `${w.slice(0, 4)}-W00` ? " · anterior" : ""}`,
          }))}
        />
        <span className="dashboard-participation-badge">
          <Icon name="clipboardCheck" size={14} />
          {participacion}% participación
        </span>
      </PageHeader>

      <div className="dashboard-metrics">
        <div className="dashboard-kpi-grid">
          <KPI iconName="users" label="Empleados" value={empleados.length} color="var(--mc-stat-teal)" />
          <KPI iconName="check" label="Contestaron" value={contestaron} sub={`de ${empleados.length}`} color="var(--mc-stat-teal-2)" />
          <KPI iconName="stable" label="Verde" value={verdes} slug="verde" />
          <KPI iconName="warning" label="Amarillo" value={amarillos} slug="amarillo" />
          <KPI iconName="critical" label="Rojo" value={rojos} slug="rojo" />
        </div>

        <Card className="pulse-hero-card dashboard-pulse-feature">
          <div className="pulse-hero-top">
            <div className="pulse-hero-icon-wrap">
              <Icon name="activity" size={22} color="var(--mc-blanco)" />
            </div>
            <div className="pulse-hero-label">Pulse Score™</div>
          </div>
          <div className="pulse-hero-value">{avgPulse ?? "—"}</div>
          <div className="pulse-hero-meta">
            <span className="pulse-hero-status" style={{ color: nivelColor(avgPulseStatus.nivel) }}>
              {avgPulseStatus.label}
            </span>
            <span className="pulse-hero-dot">·</span>
            <span>Semáforo {avgPulseStatus.semaforo}</span>
          </div>
          <div className="pulse-hero-sub">Promedio organizacional del periodo</div>
        </Card>
      </div>

      <div className="admin-grid-2 psico-dash-grid">
        {/* Distribución del equipo */}
        <Card>
          <SectionTitle icon="activity">Distribución del equipo</SectionTitle>
          {conDatos === 0 ? (
            <p className="admin-empty">Aún no hay encuestas para evaluar el semáforo.</p>
          ) : (
            <>
              <div className="psico-dist-bar" role="img" aria-label="Distribución de semáforo del equipo">
                {["verde", "amarillo", "rojo", "sin-datos"].map((k) =>
                  dist[k] > 0 ? (
                    <div
                      key={k}
                      className="psico-dist-seg"
                      style={{ flexGrow: dist[k], background: nivelColor(k) }}
                      title={`${nivelMeta(k).label}: ${dist[k]}`}
                    />
                  ) : null
                )}
              </div>
              <div className="psico-dist-legend">
                {["verde", "amarillo", "rojo", "sin-datos"].map((k) => (
                  <div key={k} className="psico-dist-item">
                    <span className="psico-dist-dot" style={{ background: nivelColor(k) }} />
                    <span className="psico-dist-label">{nivelMeta(k).label}</span>
                    <span className="psico-dist-count">{dist[k]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Participación semanal */}
        <Card>
          <SectionTitle icon="clipboardCheck">Participación · Semana {weekSel}</SectionTitle>
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

      {/* Tendencia del bienestar por oficina (igual que Psicóloga) */}
      <Card>
        <SectionTitle icon="trending">Tendencia del bienestar por oficina</SectionTitle>
        {!trendPorOficinaHayDatos ? (
          <p className="admin-empty">Se necesitan al menos 2 semanas con datos para la tendencia.</p>
        ) : (
          <>
            <GroupedBarChart labels={trendLabels} series={trendSeries} height={200} />
            <div className="psico-trend-legend">
              {trendSeries.map((s) => (
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

      <Card>
        <SectionTitle icon="alert">Sucursales en riesgo</SectionTitle>
        {sucursalesRiesgo.length === 0 ? (
          <p className="admin-empty">Ninguna sucursal con casos en amarillo o rojo esta semana.</p>
        ) : (
          <div className="psico-suc-list">
            {sucursalesRiesgo.map((s) => (
              <button
                key={s.suc}
                type="button"
                className="psico-suc-row psico-suc-row--clickable"
                title={`${s.riesgo} en riesgo: ${s.emps.map((e) => e.emp.name.split(" ")[0]).join(", ")}`}
                onClick={() => setSucRiesgoModal(s)}
              >
                <div className="psico-suc-head">
                  <span className="psico-suc-name">{s.suc}</span>
                  <span className="psico-suc-count">{s.riesgo}/{s.total} <Icon name="eye" size={13} /></span>
                </div>
                <div className="psico-suc-track">
                  <div className="psico-suc-fill" style={{ width: `${Math.round((s.riesgo / s.total) * 100)}%` }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="dashboard-grid-2 dashboard-grid-2--single">
        <Card className="dashboard-chart-card dashboard-chart-card--sucursal">
          <div className="dashboard-sucursal-card-head">
            <SectionTitle icon="building">Score por Sucursal</SectionTitle>
            <p className="dashboard-chart-hint dashboard-chart-hint--action">
              Haz clic en una sucursal para ver colaboradores.
            </p>
          </div>
          <div className="dashboard-sucursal-rank-shell">
            <div className="dashboard-sucursal-rank-list">
              {porSucursal.map((s) => {
                const sinDatos = !s.hasData || s.v == null || !Number.isFinite(Number(s.v));
                const score = sinDatos ? null : Number(s.v);
                const barPct = sinDatos ? 8 : Math.max(12, Math.min(100, score));
                return (
                  <button
                    key={s.label}
                    type="button"
                    className={`dashboard-sucursal-rank-row${sinDatos ? " dashboard-sucursal-rank-row--empty" : ""}`}
                    onClick={() => setSucursalModal(s.label)}
                    title={s.label}
                  >
                    <span className="dashboard-sucursal-rank-name">{s.label}</span>
                    <span className="dashboard-sucursal-rank-bar-wrap">
                      <span
                        className="dashboard-sucursal-rank-bar"
                        style={{
                          width: `${barPct}%`,
                          background: sucursalScoreColor(score),
                        }}
                      />
                    </span>
                    <span className="dashboard-sucursal-rank-score">
                      {sinDatos ? "Sin datos" : score}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <AnimatePresence>
      {detalleSucursal && (
        <motion.div
          className="mc-modal-overlay dashboard-sucursal-overlay"
          onClick={() => setSucursalModal(null)}
          role="presentation"
          {...overlayMotion}
        >
          <motion.div
            className="mc-modal dashboard-sucursal-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-sucursal-modal-title"
            {...modalMotion}
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
                {detalleSucursal.promedio == null ? (
                  <>
                    <span className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--empty">—</span>
                    <span className="dashboard-sucursal-kpi-sub">Sin datos</span>
                  </>
                ) : (
                  <>
                    <span
                      className="dashboard-sucursal-kpi-value"
                      style={{ color: nivelColor(detalleSucursal.promedioStatus.nivel) }}
                    >
                      {detalleSucursal.promedio}
                    </span>
                    <span className="dashboard-sucursal-kpi-sub">Bienestar promedio</span>
                  </>
                )}
              </div>
              <div className="dashboard-sucursal-kpi-card">
                <span className="dashboard-sucursal-kpi-label">Semáforo promedio</span>
                {detalleSucursal.promedio == null ? (
                  <>
                    <span className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--empty">—</span>
                    <span className="dashboard-sucursal-kpi-sub">Sin datos</span>
                  </>
                ) : (
                  <>
                    <div className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--badge">
                      {semaforoToBadge(detalleSucursal.promedioStatus.semaforo) ? (
                        <Badge tipo={semaforoToBadge(detalleSucursal.promedioStatus.semaforo)} />
                      ) : (
                        <span className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--text">
                          {detalleSucursal.promedioStatus.semaforo}
                        </span>
                      )}
                    </div>
                    <span className="dashboard-sucursal-kpi-sub">Clasificación</span>
                  </>
                )}
              </div>
            </div>

            <div className="dashboard-sucursal-list-wrap">
              <h3 className="dashboard-sucursal-list-title">Colaboradores de la sucursal</h3>
              {detalleSucursal.filas.length === 0 ? (
                <p className="dashboard-sucursal-empty">No hay colaboradores registrados en esta sucursal.</p>
              ) : (
                <div className="dashboard-sucursal-list">
                  {detalleSucursal.filas.map(({ empleado, score, color, sinDatos, status, contestoSemana }) => (
                    <div key={empleado.id} className="dashboard-sucursal-emp-row">
                      <div className="dashboard-sucursal-emp-info">
                        <Avatar name={empleado.name} size={40} color={color} photoUrl={empleado.avatarUrl} />
                        <div className="dashboard-sucursal-emp-text">
                          <div className="dashboard-sucursal-emp-name">{empleado.name}</div>
                          <div className="dashboard-sucursal-emp-puesto">{empleado.puesto || "Sin puesto"}</div>
                        </div>
                      </div>
                      <div className="dashboard-sucursal-emp-badges">
                        <span className="dashboard-sucursal-tag dashboard-sucursal-tag--muted">
                          Pulse: {sinDatos ? "Sin datos" : score}
                        </span>
                        <span className="dashboard-sucursal-tag dashboard-sucursal-tag--muted">
                          Semáforo:{" "}
                          {sinDatos
                            ? "Sin evaluación"
                            : semaforoToBadge(status.semaforo)
                              ? status.semaforo
                              : status.label}
                        </span>
                        <span
                          className={`dashboard-sucursal-tag dashboard-sucursal-tag--${contestoSemana ? "ok" : "pending"}`}
                        >
                          Encuesta: {contestoSemana ? "Completada" : "Pendiente"}
                        </span>
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
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {sucRiesgoModal && (
        <motion.div className="mc-modal-overlay" onClick={() => setSucRiesgoModal(null)} {...overlayMotion}>
          <motion.div className="mc-modal psico-suc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="admin-suc-riesgo-modal-title" {...modalMotion}>
            <div className="psico-suc-modal-head">
              <div>
                <h2 id="admin-suc-riesgo-modal-title" className="mc-modal-title">
                  <Icon name="building" size={18} /> {sucRiesgoModal.suc}
                </h2>
                <p className="admin-page-subtitle psico-suc-modal-sub">
                  {sucRiesgoModal.riesgo} de {sucRiesgoModal.total} colaboradores en riesgo
                </p>
              </div>
              <button type="button" className="dashboard-sucursal-modal-close" onClick={() => setSucRiesgoModal(null)} aria-label="Cerrar">
                <Icon name="xCircle" size={20} />
              </button>
            </div>
            <div className="psico-suc-modal-list">
              {sucRiesgoModal.emps.map(({ emp, score, nivel, tendencia }) => (
                <div key={emp.id} className={`psico-suc-emp psico-suc-emp--${nivel}`}>
                  <div className="psico-suc-emp-info">
                    <div className="psico-suc-emp-name">{emp.name}</div>
                    <div className="psico-suc-emp-meta">{emp.puesto}</div>
                  </div>
                  <div className="psico-suc-emp-right">
                    <span className="psico-suc-emp-score">Score {tieneScoreValido(score) ? score : "—"} {tendencia}</span>
                    <Badge tipo={nivel} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

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
                  <Avatar name={emp.name} size={40} color={nivelColor("rojo")} photoUrl={emp.avatarUrl} />
                  <div className="dashboard-employee-info">
                    <div className="dashboard-employee-name">{emp.name}</div>
                    <div className="dashboard-employee-meta">
                      {normalizeSucursal(emp.sucursal)} · {emp.puesto}
                    </div>
                  </div>
                  <Badge tipo="rojo" />
                  <PulseScoreBadge
                    score={ps.score}
                    nivel={ps.nivel}
                    slug={ps.slug}
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
