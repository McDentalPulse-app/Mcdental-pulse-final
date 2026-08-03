import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import KPI from "../common/KPI";
import Icon from "../ui/Icon";
import WeekSelect from "../common/WeekSelect";
import PageHeader from "../common/PageHeader";
import TendenciaBienestar from "./TendenciaBienestar";
import SucursalesEnRiesgo from "./SucursalesEnRiesgo";
import FocoRojo from "./FocoRojo";
import ScorePorSucursal from "./ScorePorSucursal";
import { usePulseSemana } from "../../hooks/usePulseSemana";
import { nivelColor } from "../../config/theme";
import "./AdminDashboard.css";

/**
 * Dashboard de administración.
 *
 * El calculo (semana, scores, semaforo, sucursales en riesgo) vive en usePulseSemana, y los
 * bloques en sus propios componentes: los tres dashboards enseñaban lo mismo con el codigo
 * duplicado y ya habian empezado a divergir. Aqui solo queda la composicion.
 */
const AdminDashboard = ({ encuestas = [] }) => {
  const { usuarios: USERS, nombresSucursales } = useGlobal();
  const {
    empleados, semana, setWeekSel, labelActual, opcionesSemana,
    pulsePorEmpleado, contestaron, verdes, amarillos, rojos,
    enFocoRojo, sucursalesRiesgo, porSucursal, avgPulse, avgPulseStatus, participacion,
  } = usePulseSemana(encuestas, USERS, nombresSucursales);

  return (
    <div className="admin-page dashboard-page">
      <PageHeader
        icon="dashboard"
        eyebrow="McDental Pulse · Administración"
        title="Dashboard Global"
        subtitle={`Visión ejecutiva del bienestar organizacional · ${empleados.length} colaboradores activos`}
      >
        <WeekSelect
          value={semana}
          onChange={setWeekSel}
          options={opcionesSemana.map((w) => ({ value: w, label: `${w}${w === labelActual ? " · actual" : ""}` }))}
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
          <div className="pulse-hero-sub">Promedio organizacional del periodo</div>
        </Card>
      </div>

      <TendenciaBienestar encuestas={encuestas} usuarios={USERS} />

      <Card>
        <div className="admin-grid-2">
          <div><SucursalesEnRiesgo sucursales={sucursalesRiesgo} /></div>
          <div><FocoRojo empleados={enFocoRojo} /></div>
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

export default AdminDashboard;
