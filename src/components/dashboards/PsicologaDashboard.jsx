import { useGlobal } from "../../contexts/GlobalContext";
import { useAuth } from "../../contexts/AuthContext";
import Card from "../common/Card";
import KPI from "../common/KPI";
import SectionTitle from "../common/SectionTitle";
import Badge from "../common/Badge";
import Icon from "../ui/Icon";
import TendenciaBienestar from "./TendenciaBienestar";
import SucursalesEnRiesgo from "./SucursalesEnRiesgo";
import ScorePorSucursal from "./ScorePorSucursal";
import WeekSelect from "../common/WeekSelect";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
import { usePulseSemana } from "../../hooks/usePulseSemana";
import { normalizeSucursal } from "../../utils/constants";
import { tieneScoreValido } from "../../utils/pulseScore";
import { nivelColor } from "../../config/theme";

/**
 * Dashboard de psicologia organizacional.
 *
 * Comparte cabecera, calculo y bloques con el de admin (usePulseSemana + los componentes de
 * dashboards/): antes tenia su propia copia de las mismas ~60 lineas de buckets de semana y
 * promedios, y ya habian empezado a divergir. Lo que SI es suyo es «Casos prioritarios», que
 * mira a las personas en amarillo o rojo con su tendencia, no a las sucursales.
 *
 * NO lleva «Empleados en Foco Rojo» aunque el de admin si: seria la misma gente dos veces en
 * la misma pantalla, y aqui ya se ve con mas detalle.
 */
const PsicologaDashboard = ({ encuestas = [], mensajes = [], reportesConfidenciales = [] }) => {
  const { usuarios: USERS, nombresSucursales } = useGlobal();
  const { user } = useAuth();

  const {
    empleados, semana, setWeekSel, labelActual, opcionesSemana,
    pulsePorEmpleado, contestaron, verdes, amarillos, rojos,
    sucursalesRiesgo, porSucursal, avgPulse, avgPulseStatus,
  } = usePulseSemana(encuestas, USERS, nombresSucursales);

  const reportesNuevos = reportesConfidenciales.filter((r) => r.estado === "nuevo").length;
  const mensajesNoLeidos = mensajes.filter((m) => m.para === user?.id && !m.leido).length;

  // Las personas en amarillo o rojo, los rojos primero. Seis como mucho: esta pantalla es para
  // decidir a quien llamar hoy, y una lista de cuarenta no ayuda a decidir nada.
  const casosPrioritarios = pulsePorEmpleado
    .filter((e) => !e.sinDatos && (e.status.semaforo === "Rojo" || e.status.semaforo === "Amarillo"))
    .map((e) => ({
      emp: e.empleado,
      score: e.score,
      tendencia: e.pulse.tendencia,
      nivel: e.status.semaforo === "Rojo" ? "rojo" : "amarillo",
    }))
    .sort((a, b) => (a.nivel === "rojo" ? -1 : 1) - (b.nivel === "rojo" ? -1 : 1))
    .slice(0, 6);

  return (
    <div className="admin-page dashboard-page psico-dashboard">
      <PageHeader
        icon="heart"
        eyebrow="McDental Pulse · Psicología Organizacional"
        title="Dashboard Psicóloga"
        subtitle="Seguimiento clínico, bienestar emocional y casos prioritarios del equipo."
      >
        <WeekSelect
          value={semana}
          onChange={setWeekSel}
          options={opcionesSemana.map((w) => ({ value: w, label: `${w}${w === labelActual ? " · actual" : ""}` }))}
        />
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
      </PageHeader>

      {/* Misma rejilla y mismo Pulse Score que el dashboard de admin: son la misma empresa vista
          desde dos sillas, y que cada pantalla invente su lenguaje visual obliga a reaprenderla
          al cambiar de rol. */}
      <div className="dashboard-metrics">
        <div className="dashboard-kpi-grid">
          <KPI iconName="users" label="Colaboradores" value={empleados.length} color="var(--mc-stat-teal)" />
          <KPI iconName="check" label="Contestaron" value={contestaron} sub={`de ${empleados.length}`} color="var(--mc-stat-teal-2)" />
          <KPI iconName="stable" label="Verde" value={verdes} slug="verde" />
          <KPI iconName="warning" label="Amarillo" value={amarillos} slug="amarillo" />
          <KPI iconName="critical" label="Rojo" value={rojos} slug="rojo" />
        </div>

        <Card className="pulse-hero-card dashboard-pulse-feature">
          <div className="pulse-hero-top">
            <div className="pulse-hero-icon-wrap">
              <Icon name="activity" size={22} color="var(--mc-verde)" />
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
          <div className="pulse-hero-sub">Promedio del equipo en el periodo</div>
        </Card>
      </div>

      <TendenciaBienestar encuestas={encuestas} usuarios={USERS} semana={semana} />

      <Card>
        <div className="admin-grid-2">
          <div>
            <SucursalesEnRiesgo
              sucursales={sucursalesRiesgo}
              vacio="Ninguna sucursal con casos en amarillo o rojo."
            />
          </div>

          <div>
            <SectionTitle icon="target">Casos prioritarios</SectionTitle>
            {casosPrioritarios.length === 0 ? (
              <EmptyState icon="check" message="No hay casos en amarillo o rojo." />
            ) : (
              <div className="psico-priority-grid">
                {casosPrioritarios.map(({ emp, score, tendencia, nivel }) => (
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
                        Score {tieneScoreValido(score) ? score : "—"}
                      </span>
                      <span className="psico-priority-stat">
                        <Icon name="trending" size={14} />
                        Tendencia {tendencia}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <ScorePorSucursal
        porSucursal={porSucursal}
        empleados={empleados}
        pulsePorEmpleado={pulsePorEmpleado}
      />
    </div>
  );
};

export default PsicologaDashboard;
