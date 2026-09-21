import { useMemo } from "react";
import SectionTitle from "../common/SectionTitle";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { ETIQUETA_CAUSA } from "../../utils/permisos";
import { clasificarDia, hoyEnClinica, diaISO, mapaZonas, zonaDe, ESTADOS_DIA } from "../../utils/asistencia";

// Variantes de .mc-status-pill que ya existen en App.css — mismo mapeo que CalendarioRH.jsx,
// para que "Vacaciones"/"Permiso"/festivo se vean con el mismo color en toda la app.
const VARIANTE_TIPO = { Vacaciones: "vacaciones", Permiso: "permiso", Intercambio: "activo" };

/**
 * Quién falta hoy pero con la falta YA JUSTIFICADA — vacaciones, permiso aprobado, o un
 * cambio de festivo (intercambio). No es lo mismo que "Foco Rojo": esto es informativo (para
 * que RH/admin sepan de un vistazo quién no está y por qué, sin tener que ir a buscarlo),
 * no una alerta.
 *
 * clasificarDia() (utils/asistencia.js) solo sabe de permisos y vacaciones — un intercambio
 * aprobado NO lo marca JUSTIFICADO, así que ese caso se cruza aparte contra `intercambios`.
 *
 * "Hoy" se calcula POR SUCURSAL (zonaDe/mapaZonas): con un solo huso para todos, a la gente
 * de Hermosillo se le evaluaría el día equivocado durante buena parte de la tarde.
 */
const FaltasJustificadasHoy = ({
  empleados = [],
  permisos = [],
  vacaciones = [],
  intercambios = [],
  horarios = [],
  checadasHoy = [],
  sucursales = [],
}) => {
  const zonas = useMemo(() => mapaZonas(sucursales), [sucursales]);

  const lista = useMemo(() => {
    const salida = [];
    for (const emp of empleados) {
      const tz = zonaDe(zonas, emp.sucursal);
      const hoy = hoyEnClinica(tz);
      const horario = horarios.find((h) => h.empleadoId === emp.id && h.diaSemana === diaISO(hoy));
      const checadasEmp = checadasHoy.filter((c) => c.empleadoId === emp.id);

      const dia = clasificarDia({
        fecha: hoy,
        checadas: checadasEmp,
        horario,
        permisos: permisos.filter((p) => p.empleadoId === emp.id),
        vacaciones: vacaciones.filter((v) => v.empleadoId === emp.id),
        tz,
        hoy,
      });

      if (dia.estado === ESTADOS_DIA.JUSTIFICADO) {
        const j = dia.justificacion;
        const esVacacion = !!j?.fechaInicio;
        salida.push({
          empleado: emp,
          tipo: esVacacion ? "Vacaciones" : "Permiso",
          motivo: esVacacion ? "Vacaciones" : (ETIQUETA_CAUSA[j?.causa] || "Permiso"),
        });
        continue;
      }

      // Sin checada y con turno hoy, pero clasificarDia no encontró permiso/vacación: puede
      // ser un cambio de festivo, que vive en su propia tabla (intercambiosService), ajena
      // por completo a permisos/vacaciones.
      if (horario && !checadasEmp.length) {
        const intercambio = intercambios.find(
          (i) => i.empleadoId === emp.id && i.estado === "aprobado" && i.fechaDestino === hoy
        );
        if (intercambio) {
          salida.push({ empleado: emp, tipo: "Intercambio", motivo: "Cambio por festivo" });
        }
      }
    }
    return salida;
  }, [empleados, permisos, vacaciones, intercambios, horarios, checadasHoy, zonas]);

  return (
    <>
      <div className="dashboard-foco-header">
        <SectionTitle icon="check" className="dashboard-foco-title">
          Faltas justificadas hoy
        </SectionTitle>
        <span className="dashboard-foco-count">{lista.length}</span>
      </div>

      {!lista.length ? (
        <div className="dashboard-empty dashboard-empty--ok">
          <Icon name="check" size={18} />
          Nadie con falta justificada hoy
        </div>
      ) : (
        <div className="dashboard-foco-list">
          {lista.map(({ empleado, tipo, motivo }) => (
            <div key={empleado.id} className="dashboard-employee-row">
              <Avatar name={empleado.name} size={40} photoUrl={empleado.avatarUrl} />
              <div className="dashboard-employee-info">
                <div className="dashboard-employee-name">{empleado.name}</div>
                <div className="dashboard-employee-meta">
                  {normalizeSucursal(empleado.sucursal)} · {empleado.puesto}
                </div>
              </div>
              <Badge variant={VARIANTE_TIPO[tipo] || "festivo"}>{motivo}</Badge>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default FaltasJustificadasHoy;
