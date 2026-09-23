import { useMemo } from "react";
import SectionTitle from "../common/SectionTitle";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { normalizeSucursal } from "../../utils/constants";
import { ETIQUETA_CAUSA } from "../../utils/permisos";
import { clasificarDia, hoyEnClinica, diaISO, mapaZonas, zonaDe, ESTADOS_DIA } from "../../utils/asistencia";

// Variantes de .mc-status-pill que ya existen en App.css — mismo mapeo que CalendarioRH.jsx,
// para que "Vacaciones"/"Permiso"/"Festivo" se vean con el mismo color en toda la app.
const VARIANTE_TIPO = { Vacaciones: "vacaciones", Permiso: "permiso", Intercambio: "activo", Festivo: "festivo" };

/**
 * Quién falta hoy pero con la falta YA JUSTIFICADA — vacaciones, permiso aprobado, un festivo
 * del calendario, o el día que ganó a cambio de trabajar uno (intercambio). No es lo mismo que
 * "Foco Rojo": esto es informativo (para que RH/admin sepan de un vistazo quién no está y por
 * qué, sin tener que ir a buscarlo), no una alerta.
 *
 * El criterio es EL MISMO clasificarDia() de utils/asistencia.js que usan el calendario de
 * Asistencia y la Nómina — festivos e intercambios incluidos. Solo se distingue aquí, después,
 * si el FESTIVO es el del calendario o el día destino de un intercambio, para mostrar el motivo
 * correcto ("Festivo" vs "Cambio por festivo"); la decisión de si cuenta como falta ya la tomó
 * clasificarDia.
 *
 * "Hoy" se calcula POR SUCURSAL (zonaDe/mapaZonas): con un solo huso para todos, a la gente
 * de Hermosillo se le evaluaría el día equivocado durante buena parte de la tarde.
 */
const FaltasJustificadasHoy = ({
  empleados = [],
  permisos = [],
  vacaciones = [],
  festivos = [],
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
      const misIntercambios = intercambios.filter((i) => i.empleadoId === emp.id);

      const dia = clasificarDia({
        fecha: hoy,
        checadas: checadasEmp,
        horario,
        permisos: permisos.filter((p) => p.empleadoId === emp.id),
        vacaciones: vacaciones.filter((v) => v.empleadoId === emp.id),
        festivos,
        intercambios: misIntercambios,
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

      if (dia.estado === ESTADOS_DIA.FESTIVO) {
        // Si hoy es el DESTINO de un intercambio aprobado suyo, es el descanso que ganó a
        // cambio de trabajar el festivo que cedió — se distingue del festivo de calendario
        // solo para el texto, la clasificación ya es la misma para ambos.
        const esCompensatorio = misIntercambios.some((i) => i.estado === "aprobado" && i.fechaDestino === hoy);
        salida.push({
          empleado: emp,
          tipo: esCompensatorio ? "Intercambio" : "Festivo",
          motivo: esCompensatorio ? "Cambio por festivo" : "Festivo",
        });
      }
    }
    return salida;
  }, [empleados, permisos, vacaciones, festivos, intercambios, horarios, checadasHoy, zonas]);

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
