import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { sucursalMatches } from "../../utils/constants";
import { getPulseStatus } from "../../utils/pulseScore";
import { nivelColor } from "../../config/theme";

/**
 * Ranking de sucursales por Pulse Score, y el detalle de cada una al pulsarla.
 *
 * Estaba solo en el dashboard de admin. Se comparte para que RH y psicóloga lo tengan también:
 * es la vista que contesta «¿qué clínica va peor y quién está dentro?», y esa pregunta no es
 * exclusiva de dirección — RH la necesita para repartir su atención y psicología para priorizar.
 *
 * Se listan TODAS las sucursales activas, también las que no tienen ni una respuesta: salen como
 * «Sin datos». Omitirlas escondería justo a las que no contestan, que suelen ser las que más
 * conviene mirar.
 */
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

const semaforoToBadge = (semaforo) => {
  if (semaforo === "Verde") return "verde";
  if (semaforo === "Amarillo") return "amarillo";
  if (semaforo === "Rojo") return "rojo";
  return null;
};

/** Color de la barra del ranking. Cortes propios, más laxos que el semáforo del Pulse Score:
 *  aquí se compara una sucursal contra las demás, no a una persona contra su umbral clínico. */
const colorBarra = (val) => {
  if (val == null || !Number.isFinite(Number(val))) return "var(--mc-riskbar-track)";
  if (val >= 70) return "var(--mc-stat-green)";
  if (val >= 45) return "var(--mc-stat-amber)";
  return "var(--mc-stat-red)";
};

const construirDetalle = (nombreSucursal, empleados, pulsePorEmpleado) => {
  const porId = new Map(pulsePorEmpleado.map((p) => [p.empleado.id, p]));
  const empsSucursal = empleados.filter((e) => sucursalMatches(e.sucursal, nombreSucursal));

  const filas = empsSucursal
    .map((emp) => {
      const p = porId.get(emp.id);
      const sinDatos = !p || p.sinDatos;
      const score = sinDatos ? null : p.score;
      const status = sinDatos
        ? { label: "Sin evaluación", semaforo: "Sin evaluación", nivel: "sin-datos" }
        : getPulseStatus(score);
      return {
        empleado: emp,
        score,
        color: nivelColor(status.nivel),
        sinDatos,
        status,
        contestoSemana: !sinDatos,
        // Los que no contestaron van al final, no arriba con un 0 que no significa nada.
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

  return {
    nombre: nombreSucursal,
    total: empsSucursal.length,
    contestaron: conScore.length,
    promedio,
    promedioStatus: promedio == null
      ? { label: "Sin datos", semaforo: "Sin datos", nivel: "sin-datos" }
      : getPulseStatus(promedio),
    filas,
  };
};

const ScorePorSucursal = ({ porSucursal = [], empleados = [], pulsePorEmpleado = [] }) => {
  const [abierta, setAbierta] = useState(null);
  const detalle = abierta ? construirDetalle(abierta, empleados, pulsePorEmpleado) : null;

  return (
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
              // 8% cuando no hay datos y 12% mínimo cuando sí: una barra de ancho cero no se
              // distingue de una fila rota, y el 0 de verdad tiene que poder verse.
              const barPct = sinDatos ? 8 : Math.max(12, Math.min(100, score));
              return (
                <button
                  key={s.label}
                  type="button"
                  className={`dashboard-sucursal-rank-row${sinDatos ? " dashboard-sucursal-rank-row--empty" : ""}`}
                  onClick={() => setAbierta(s.label)}
                  title={s.label}
                >
                  <span className="dashboard-sucursal-rank-name">{s.label}</span>
                  <span className="dashboard-sucursal-rank-bar-wrap">
                    <span
                      className="dashboard-sucursal-rank-bar"
                      style={{ width: `${barPct}%`, background: colorBarra(score) }}
                    />
                  </span>
                  <span className="dashboard-sucursal-rank-score">{sinDatos ? "Sin datos" : score}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {detalle && (
          <motion.div
            className="mc-modal-overlay dashboard-sucursal-overlay"
            onClick={() => setAbierta(null)}
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
                    {detalle.nombre}
                  </h2>
                  <p className="dashboard-sucursal-modal-sub">Detalle de colaboradores y Pulse Score.</p>
                </div>
                <button
                  type="button"
                  className="dashboard-sucursal-modal-close"
                  onClick={() => setAbierta(null)}
                  aria-label="Cerrar"
                >
                  <Icon name="xCircle" size={20} />
                </button>
              </div>

              <div className="dashboard-sucursal-kpis">
                <div className="dashboard-sucursal-kpi-card">
                  <span className="dashboard-sucursal-kpi-label">Total colaboradores</span>
                  <span className="dashboard-sucursal-kpi-value">{detalle.total}</span>
                  <span className="dashboard-sucursal-kpi-sub">Registrados en sucursal</span>
                </div>
                <div className="dashboard-sucursal-kpi-card">
                  <span className="dashboard-sucursal-kpi-label">Contestaron</span>
                  <span className="dashboard-sucursal-kpi-value">{detalle.contestaron}</span>
                  <span className="dashboard-sucursal-kpi-sub">Encuesta de la semana</span>
                </div>
                <div className="dashboard-sucursal-kpi-card">
                  <span className="dashboard-sucursal-kpi-label">Promedio Pulse</span>
                  {detalle.promedio == null ? (
                    <>
                      <span className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--empty">—</span>
                      <span className="dashboard-sucursal-kpi-sub">Sin datos</span>
                    </>
                  ) : (
                    <>
                      <span
                        className="dashboard-sucursal-kpi-value"
                        style={{ color: nivelColor(detalle.promedioStatus.nivel) }}
                      >
                        {detalle.promedio}
                      </span>
                      <span className="dashboard-sucursal-kpi-sub">Bienestar promedio</span>
                    </>
                  )}
                </div>
                <div className="dashboard-sucursal-kpi-card">
                  <span className="dashboard-sucursal-kpi-label">Semáforo promedio</span>
                  {detalle.promedio == null ? (
                    <>
                      <span className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--empty">—</span>
                      <span className="dashboard-sucursal-kpi-sub">Sin datos</span>
                    </>
                  ) : (
                    <>
                      <div className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--badge">
                        {semaforoToBadge(detalle.promedioStatus.semaforo) ? (
                          <Badge tipo={semaforoToBadge(detalle.promedioStatus.semaforo)} />
                        ) : (
                          <span className="dashboard-sucursal-kpi-value dashboard-sucursal-kpi-value--text">
                            {detalle.promedioStatus.semaforo}
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
                {detalle.filas.length === 0 ? (
                  <p className="dashboard-sucursal-empty">No hay colaboradores registrados en esta sucursal.</p>
                ) : (
                  <div className="dashboard-sucursal-list">
                    {detalle.filas.map(({ empleado, score, color, sinDatos, status, contestoSemana }) => (
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
                <button type="button" className="mc-btn-secondary" onClick={() => setAbierta(null)}>
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScorePorSucursal;
