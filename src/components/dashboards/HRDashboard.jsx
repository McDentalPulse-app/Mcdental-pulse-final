import { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import KPI from "../common/KPI";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import WeekSelect from "../common/WeekSelect";
import EmptyState from "../common/EmptyState";
import Icon from "../ui/Icon";
import TendenciaBienestar from "./TendenciaBienestar";
import SucursalesEnRiesgo from "./SucursalesEnRiesgo";
import FocoRojo from "./FocoRojo";
import ScorePorSucursal from "./ScorePorSucursal";
import { usePulseSemana } from "../../hooks/usePulseSemana";
import { getAsistencias } from "../../services/supabase/asistenciasService";
import { construirDias, resumen, mapaZonas, zonaDe, hoyEnClinica } from "../../utils/asistencia";
import { esEmpleadoActivo } from "../../utils/helpers";
import { periodoActual, rangoDePeriodo, formatSemanaDisplay } from "../../utils/constants";
import { getPulseStatus, tieneScoreValido } from "../../utils/pulseScore";
import { nivelColor } from "../../config/theme";

/**
 * Dashboard de RH.
 *
 * ESTE ARCHIVO ERA UNA MAQUETA. Hasta el 2026-08-03 enseñaba cuatro números escritos a mano
 * —«3 vacaciones pendientes», «4 retardos», «2 descuentos»— y una lista de pendientes que
 * hablaba de un tal "Luis Torres" que NO EXISTE en la base. O sea que RH llevaba meses tomando
 * decisiones, o creyendo que no había nada que decidir, mirando cifras inventadas. Ahora todo
 * sale de datos reales.
 *
 * Comparte estructura con el de admin a propósito (misma cabecera con selector, misma rejilla
 * de KPIs, el mismo bloque de tendencia): son la misma empresa vista desde dos sillas, y que
 * cada pantalla invente su propio lenguaje visual obliga a reaprenderla al cambiar de rol.
 */

const HRDashboard = () => {
  const {
    usuarios = [], sucursales = [], encuestas = [],
    vacaciones = [], permisos = [], descuentos = [], horarios = [], nombresSucursales = [],
  } = useGlobal();

  // El mismo calculo que usan admin y psicologa: semana, semaforo, sucursales en riesgo y
  // quien esta en rojo. Vive en un hook para que las tres pantallas no digan cosas distintas
  // de la misma persona.
  const {
    pulsePorEmpleado, enFocoRojo, sucursalesRiesgo, porSucursal,
  } = usePulseSemana(encuestas, usuarios, nombresSucursales);

  const empleados = useMemo(() => usuarios.filter(esEmpleadoActivo), [usuarios]);

  // ── Semana en curso y selector ────────────────────────────────────────────
  const semanasConDatos = useMemo(() => {
    const s = new Set(encuestas.map((e) => String(e.semana)).filter((x) => /^\d{4}-W\d{2}$/.test(x)));
    s.add(periodoActual);
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [encuestas]);

  const [semana, setSemana] = useState(periodoActual);
  const rango = useMemo(() => rangoDePeriodo(semana), [semana]);

  // ── Asistencia de la semana elegida ───────────────────────────────────────
  // Se pide al abrir y al cambiar de semana, no se guarda en el contexto: son miles de filas y
  // solo las necesita esta pantalla.
  const [checadas, setChecadas] = useState([]);
  const [cargandoAsistencia, setCargando] = useState(true);
  const [errorAsistencia, setError] = useState(null);

  // Mismo patrón que AsistenciaPanel: la carga vive en un useCallback y el efecto solo la
  // dispara. Poner el setState directamente en el cuerpo del efecto encadena renders, y el
  // linter de hooks lo marca con razón.
  const cargarAsistencia = useCallback(() => {
    if (!rango) return undefined;
    let cancelado = false;
    getAsistencias({ desde: rango.desde, hasta: rango.hasta })
      .then((rows) => { if (!cancelado) { setChecadas(rows); setError(null); } })
      .catch((e) => {
        if (cancelado) return;
        console.error("Error cargando asistencia del dashboard:", e);
        setError(e?.message || "No se pudo cargar la asistencia.");
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [rango]);

  useEffect(() => cargarAsistencia(), [cargarAsistencia]);

  const zonas = useMemo(() => mapaZonas(sucursales), [sucursales]);

  // Retardos y faltas de la semana, con el MISMO construirDias que pinta el calendario y los
  // reportes. Dos criterios distintos serían dos pantallas diciendo cosas distintas de la
  // misma persona.
  const asistencia = useMemo(() => {
    if (!rango) return { retardos: 0, faltas: 0, incompletos: 0 };
    const hoy = hoyEnClinica();
    // No se juzga más allá de hoy: los días que aún no han llegado no son falta de nadie.
    const hasta = rango.hasta > hoy ? hoy : rango.hasta;
    let retardos = 0, faltas = 0, incompletos = 0;

    for (const u of empleados) {
      const dias = construirDias({
        desde: rango.desde,
        hasta,
        checadas: checadas.filter((c) => c.empleadoId === u.id),
        horarios: horarios.filter((h) => h.empleadoId === u.id),
        permisos: permisos.filter((p) => p.empleadoId === u.id),
        vacaciones: vacaciones.filter((v) => v.empleadoId === u.id),
        fechaIngreso: u.fechaIngreso,
        tz: zonaDe(zonas, u.sucursal),
      });
      const r = resumen(dias);
      retardos += r.retardos;
      faltas += r.faltas;
      incompletos += r.incompletos;
    }
    return { retardos, faltas, incompletos };
  }, [rango, empleados, checadas, horarios, permisos, vacaciones, zonas]);

  // ── Solicitudes que esperan a RH ──────────────────────────────────────────
  const vacacionesPend = useMemo(() => vacaciones.filter((v) => v.estado === "pendiente"), [vacaciones]);
  const permisosPend = useMemo(() => permisos.filter((p) => p.estado === "pendiente"), [permisos]);
  const descuentosSemana = useMemo(
    () => (rango ? descuentos.filter((d) => d.fecha >= rango.desde && d.fecha <= rango.hasta) : []),
    [descuentos, rango]
  );

  // ── Pulse Score de la semana ──────────────────────────────────────────────
  const encSemana = useMemo(() => encuestas.filter((e) => String(e.semana) === semana), [encuestas, semana]);
  const scores = encSemana.map((e) => Number(e.score)).filter((s) => tieneScoreValido(s));
  const avgPulse = scores.length ? Math.round(scores.reduce((a, c) => a + c, 0) / scores.length) : null;
  const estadoPulse = getPulseStatus(avgPulse);
  const participacion = empleados.length
    ? Math.round((new Set(encSemana.map((e) => e.empleadoId)).size / empleados.length) * 100)
    : 0;

  const nombreDe = useCallback(
    (id) => usuarios.find((u) => u.id === id)?.name || "Alguien",
    [usuarios]
  );

  const pendientes = useMemo(() => [
    ...vacacionesPend.map((v) => ({
      id: `v-${v.id}`, icon: "vacation",
      texto: `${v.empleado || nombreDe(v.empleadoId)} pidió vacaciones del ${v.fechaInicio} al ${v.fechaFin}.`,
    })),
    ...permisosPend.map((p) => ({
      id: `p-${p.id}`, icon: "calendar",
      texto: `${p.empleado || nombreDe(p.empleadoId)} pidió un permiso para el ${p.fecha}${p.motivo ? ` · ${p.motivo}` : ""}.`,
    })),
  ], [vacacionesPend, permisosPend, nombreDe]);

  return (
    <div className="admin-page dashboard-page">
      <PageHeader
        icon="users"
        eyebrow="McDental Pulse · Recursos Humanos"
        title="Dashboard RH"
        subtitle={`Vacaciones, permisos, descuentos y asistencia · ${empleados.length} colaboradores activos`}
      >
        <WeekSelect
          value={semana}
          onChange={setSemana}
          options={semanasConDatos.map((w) => ({
            value: w,
            label: `${w}${w === periodoActual ? " · actual" : ""}`,
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
          <KPI
            iconName="vacation"
            label="Por aprobar"
            value={vacacionesPend.length + permisosPend.length}
            sub={`${vacacionesPend.length} vacaciones · ${permisosPend.length} permisos`}
            color="var(--mc-stat-teal-2)"
          />
          <KPI
            iconName="clock"
            label="Retardos"
            value={cargandoAsistencia ? "…" : asistencia.retardos}
            sub="en la semana"
            slug="amarillo"
          />
          <KPI
            iconName="warning"
            label="Faltas"
            value={cargandoAsistencia ? "…" : asistencia.faltas}
            sub="sin justificar"
            slug="rojo"
          />
          <KPI
            iconName="dollar"
            label="Descuentos"
            value={descuentosSemana.length}
            sub="en la semana"
            color="var(--mc-stat-teal)"
          />
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
            <span className="pulse-hero-status" style={{ color: nivelColor(estadoPulse.nivel) }}>
              {estadoPulse.label}
            </span>
            <span className="pulse-hero-dot">·</span>
            <span>Semáforo {estadoPulse.semaforo}</span>
          </div>
          <div className="pulse-hero-sub">{`Promedio de ${semana}`}</div>
        </Card>
      </div>

      <TendenciaBienestar encuestas={encuestas} usuarios={usuarios} semana={formatSemanaDisplay(semana)} />

      <Card>
        <div className="admin-grid-2">
          <div>
            <SucursalesEnRiesgo sucursales={sucursalesRiesgo} />
          </div>

          <div>
            <SectionTitle icon="pin">Pendientes de aprobar</SectionTitle>
            {errorAsistencia && <p className="mc-hint"><Icon name="alert" size={15} />{errorAsistencia}</p>}
            {!pendientes.length ? (
              <EmptyState icon="check" message="No hay solicitudes esperando respuesta." />
            ) : (
              <div className="rh-pending-list">
                {pendientes.map((p) => (
                  <div key={p.id} className="rh-pending-item">
                    <span className="rh-pending-icon"><Icon name={p.icon} size={16} /></span>
                    <span className="rh-pending-text">{p.texto}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Foco rojo: mismo bloque que el de admin. RH ya descarga el reporte de bienestar con
          nombres y scores (migracion 099, paridad con admin), asi que esto no le da acceso
          nuevo — se lo pone delante, que es lo que hace que alguien actue. */}
      <Card>
        <FocoRojo empleados={enFocoRojo} />
      </Card>

      <ScorePorSucursal
        porSucursal={porSucursal}
        empleados={empleados}
        pulsePorEmpleado={pulsePorEmpleado}
      />
    </div>
  );
};

export default HRDashboard;
