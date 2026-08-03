import SectionTitle from "../common/SectionTitle";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { normalizeSucursal } from "../../utils/constants";
import { nivelColor } from "../../config/theme";

/**
 * Los colaboradores cuyo Pulse Score está en rojo esta semana.
 *
 * Estaba solo en el dashboard de admin. Se comparte para que RH lo tenga también: la migración
 * 099 le dio a RH las mismas capacidades que a admin y ya descarga el reporte de bienestar con
 * nombres y scores, así que verlo aquí no le da acceso nuevo — se lo pone delante, que es
 * distinto y es el punto: un número en una tabla que hay que ir a buscar no mueve a nadie.
 *
 * La psicóloga NO lo usa: su pantalla ya tiene «Casos prioritarios», que es la misma gente con
 * más detalle clínico. Poner los dos sería repetir los mismos nombres dos veces en una pantalla.
 */
const FocoRojo = ({ empleados = [] }) => (
  <>
    <div className="dashboard-foco-header">
      <SectionTitle icon="alert" className="dashboard-foco-title">
        Empleados en Foco Rojo
      </SectionTitle>
      <span className={`dashboard-foco-count${empleados.length ? " dashboard-foco-count--alert" : ""}`}>
        {empleados.length}
      </span>
    </div>

    {!empleados.length ? (
      <div className="dashboard-empty dashboard-empty--ok">
        <Icon name="check" size={18} />
        Sin empleados en foco rojo esta semana
      </div>
    ) : (
      <div className="dashboard-foco-list">
        {empleados.map((e) => {
          const emp = e.empleado;
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
                score={e.pulse.score}
                nivel={e.pulse.nivel}
                slug={e.pulse.slug}
                tendencia={e.pulse.tendencia}
                size="sm"
              />
            </div>
          );
        })}
      </div>
    )}
  </>
);

export default FocoRojo;
