import { useEffect, useMemo, useState } from "react";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import Badge from "../common/Badge";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import PulseScoreRing from "../common/PulseScoreRing";
import PulseTrendChart from "../common/PulseTrendChart";
import { useGlobal } from "../../contexts/GlobalContext";
import { periodoActual, normalizeSucursal, esPeriodoActual, getISOWeek, isoWeekToMonday } from "../../utils/constants";
import { etiquetaDePeriodo } from "../../utils/periodos";
import { calcPulseScore, tieneScoreValido } from "../../utils/pulseScore";
import { getPreguntasActivas } from "../../utils/encuestaPreguntas";
import { bloqueDeLaSemana, preguntasDeLaSemana } from "../../utils/encuestaBloques";
import {
  construirDias, mapaZonas, zonaDe, emparejarChecadas, diaISO, hoyEnClinica,
  ETIQUETA_ESTADO, ESTADOS_DIA,
} from "../../utils/asistencia";
import { calcularNomina, money } from "../../utils/nomina";
import { getAsistencias } from "../../services/supabase/asistenciasService";
import { getNominaConfig } from "../../services/supabase/nominaConfigService";
import { formatFechaCorta } from "../../utils/helpers";

const DIA_CORTO = { 1: "lun", 2: "mar", 3: "mié", 4: "jue", 5: "vie", 6: "sáb", 7: "dom" };

const ETIQUETA_ESTADO_PILL = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };

/** ¿Un rango [inicio, fin] se cruza con la semana [desde, hasta]? A diferencia de cubreFecha
 *  (una fecha suelta dentro de un rango), aquí son dos rangos: un permiso de varios días puede
 *  empezar antes del lunes y seguir dentro de la semana, o viceversa. */
const seSolapaConSemana = (inicio, fin, desde, hasta) => {
  if (!inicio || !desde || !hasta) return false;
  const i = String(inicio).slice(0, 10);
  const f = String(fin || inicio).slice(0, 10);
  return i <= hasta && f >= desde;
};

/**
 * Inicio del empleado (y del doctor, que comparte esta misma pantalla): lo que se enseña
 * al entrar. Rediseñada a pedido del dueño para que se parezca a la app de asistencia que
 * hizo el otro becario — Pulse Score con su tendencia, el día de hoy, un estimado de la
 * semana y lo pendiente (permisos, vacaciones, encuesta) de un vistazo, sin tener que entrar
 * a cinco pantallas distintas a buscarlo.
 *
 * El estimado de "Tu semana" usa construirDias()/calcularNomina() — las MISMAS funciones que
 * la Nómina de RH (utils/asistencia.js, utils/nomina.js) — para que el número que ve el
 * empleado sea, literalmente, el mismo cálculo que hace RH, no una aproximación aparte.
 */
const InicioEmpleado = ({
  user, encuestas, setActive,
  horarios = [], permisos = [], vacaciones = [], checadasHoy = [],
}) => {
  const { sucursales = [], encuestaPreguntas: ENCUESTA_PREGUNTAS, encuestaBloques, festivos = [], intercambios = [] } = useGlobal();

  // Sacados de `user` UNA vez, como valores propios del componente: usar `user.id` (etc.)
  // directo dentro de un array de dependencias de useMemo hace que el compilador de React no
  // pueda probar que ese acceso es estable entre renders y se rinda con la memoización entera.
  const { id: userId, sucursal: userSucursal, puesto: userPuesto, fechaIngreso: userFechaIngreso, sueldoSemanal: userSueldoSemanal, montoRetardoPersonal: userMontoRetardoPersonal } = user;

  const mis = encuestas.filter((e) => e.empleadoId === userId);
  const yaContesto = mis.some((e) => esPeriodoActual(e.semana));
  const ps = calcPulseScore(userId, encuestas);
  const tieneEvaluacion = !ps.sinDatos && tieneScoreValido(ps.score);

  const ultimasOcho = useMemo(
    () => mis
      .filter((e) => tieneScoreValido(e.score))
      .sort((a, b) => a.semana.localeCompare(b.semana))
      .slice(-8)
      .map((e) => ({ semana: e.semana, score: Number(e.score) })),
    [mis]
  );

  // Cuántas preguntas le tocan esta semana (núcleo + bloque quincenal): lo mismo que calcula
  // EncuestaEmpleado.jsx para pintar la pantalla de la encuesta, aquí solo para contar.
  const preguntasSemana = useMemo(() => {
    const activas = getPreguntasActivas(ENCUESTA_PREGUNTAS);
    const bloqueActivo = bloqueDeLaSemana(getISOWeek(), encuestaBloques);
    return preguntasDeLaSemana(activas, bloqueActivo);
  }, [ENCUESTA_PREGUNTAS, encuestaBloques]);

  // La semana natural (lunes a domingo) de asistencia/nómina — distinta del periodo de la
  // encuesta, que puede ser quincenal. Ver el encabezado de utils/periodos.js.
  const lunes = useMemo(() => isoWeekToMonday(getISOWeek()), []);
  const desde = lunes ? lunes.toISOString().slice(0, 10) : null;
  const hasta = lunes ? new Date(lunes.getTime() + 6 * 86400000).toISOString().slice(0, 10) : null;

  const zonas = useMemo(() => mapaZonas(sucursales), [sucursales]);
  const tz = zonaDe(zonas, userSucursal);
  const hoy = hoyEnClinica(tz);

  const horaCorta = (timestamp) => timestamp
    ? new Intl.DateTimeFormat("es-MX", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(timestamp))
    : "—";

  const misChecadasHoy = useMemo(() => checadasHoy.filter((c) => c.empleadoId === userId), [checadasHoy, userId]);
  const { entrada, salida } = useMemo(() => emparejarChecadas(misChecadasHoy), [misChecadasHoy]);
  const horarioHoy = horarios.find((h) => h.empleadoId === userId && h.diaSemana === diaISO(hoy)) || null;

  const estadoHoy = !horarioHoy
    ? "Hoy no tienes turno asignado."
    : !entrada
      ? "Te toca fichar tu entrada."
      : !salida
        ? "Te toca fichar tu salida."
        : "Ya registraste tu entrada y tu salida de hoy.";

  // El compilador de React se rinde con estos tres (y con `recibo` más abajo, que encadena de
  // ellos) y avisa "Existing memoization could not be preserved": no confía en que `userId`
  // —un primitivo sacado de la prop `user`— se mantenga estable entre renders, aunque sí lo
  // está. No es un bug: solo significa que este componente no recibe la optimización automática
  // extra del compilador: la memoización ESCRITA a mano (estos useMemo) sigue funcionando igual.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const misHorarios = useMemo(() => horarios.filter((h) => h.empleadoId === userId), [horarios, userId]);
  const misPermisos = useMemo(() => permisos.filter((p) => p.empleadoId === userId), [permisos, userId]);
  const misVacaciones = useMemo(() => vacaciones.filter((v) => v.empleadoId === userId), [vacaciones, userId]);
  // RLS ya solo entrega los intercambios propios a empleado/doctor, pero se filtra igual por
  // empleadoId para no depender de eso — mismo patrón que permisos y vacaciones arriba.
  const misIntercambios = useMemo(() => intercambios.filter((i) => i.empleadoId === userId), [intercambios, userId]);

  // Las checadas de la semana completa (no solo hoy) y el monto configurado de retardo se piden
  // aparte: `checadasHoy` que llega por props es justo eso, de hoy, y no alcanza para construir
  // los 7 días de "Tu semana". Mismo patrón que Nomina.jsx.
  const [checadasSemana, setChecadasSemana] = useState([]);
  const [config, setConfig] = useState({ montoRetardo: 0 });

  useEffect(() => {
    if (!desde || !hasta || !userId) return undefined;
    let vivo = true;
    Promise.all([
      getAsistencias({ desde, hasta, empleadoId: userId }),
      getNominaConfig(),
    ])
      .then(([filas, cfg]) => {
        if (!vivo) return;
        setChecadasSemana(filas);
        setConfig(cfg);
      })
      .catch((e) => console.error("Error cargando tu semana:", e));
    return () => { vivo = false; };
  }, [desde, hasta, userId]);

  const recibo = useMemo(() => {
    if (!desde || !hasta) return null;
    const dias = construirDias({
      desde,
      hasta,
      checadas: checadasSemana,
      horarios: misHorarios,
      permisos: misPermisos,
      vacaciones: misVacaciones,
      festivos,
      intercambios: misIntercambios,
      fechaIngreso: userFechaIngreso,
      tz,
    });
    return calcularNomina({
      dias,
      sueldoSemanal: userSueldoSemanal,
      config,
      puesto: userPuesto,
      montoRetardoPersonal: userMontoRetardoPersonal,
    });
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- ver el comentario de misHorarios arriba
  }, [desde, hasta, checadasSemana, misHorarios, misPermisos, misVacaciones, festivos, misIntercambios, userFechaIngreso, userSueldoSemanal, userPuesto, userMontoRetardoPersonal, config, tz]);

  const resumenSemana = recibo && recibo.retardos === 0 && recibo.faltas === 0
    ? "Sin retardos ni faltas."
    : [
        recibo?.retardos > 0 ? `${recibo.retardos} retardo${recibo.retardos === 1 ? "" : "s"}` : null,
        recibo?.faltas > 0 ? `${recibo.faltas} falta${recibo.faltas === 1 ? "" : "s"}` : null,
      ].filter(Boolean).join(" · ");

  const etiquetaEstadoDia = (dia) => {
    if (dia.estado === ESTADOS_DIA.PENDIENTE) return dia.fecha === hoy ? "En curso" : "Pendiente";
    return ETIQUETA_ESTADO[dia.estado] || dia.estado;
  };

  const permisosSemana = useMemo(
    () => misPermisos.filter((p) => p.estado !== "rechazado" && seSolapaConSemana(p.fecha, p.fechaFin, desde, hasta)),
    [misPermisos, desde, hasta]
  );
  const vacacionesSemana = useMemo(
    () => misVacaciones.filter((v) => v.estado !== "rechazado" && seSolapaConSemana(v.fechaInicio, v.fechaFin, desde, hasta)),
    [misVacaciones, desde, hasta]
  );

  return (
    <div className="admin-page empleado-page empleado-page--home">
      <header className="empleado-welcome-header">
        <div>
          <span className="dashboard-eyebrow">McDental Pulse · Mi espacio</span>
          <h1 className="admin-page-title">Hola, {(user.name || "").split(" ")[0].toUpperCase()}</h1>
          <p className="admin-page-subtitle">{normalizeSucursal(user.sucursal)}</p>
          <p className="admin-page-subtitle empleado-home-puesto">{user.puesto}</p>
        </div>
      </header>

      <Card className="empleado-pulse-card">
        <SectionTitle icon="activity">Mi bienestar</SectionTitle>
        {tieneEvaluacion ? (
          <>
            <div className="mc-pulse-ring-wrap">
              <PulseScoreRing score={ps.score} slug={ps.slug} />
              <div className="mc-pulse-ring-caption">Tu pulso de tu última encuesta</div>
            </div>
            {ultimasOcho.length > 1 && (
              <>
                <PulseTrendChart datos={ultimasOcho} />
                <p className="mc-hint mc-pulse-trend-caption">
                  Tus últimas {ultimasOcho.length} encuestas · las rayas son el 60 y el 80
                </p>
              </>
            )}
          </>
        ) : (
          <div className="empleado-empty-inline">
            <Icon name="activity" size={18} />
            <span>Sin evaluación · completa tu encuesta semanal para ver tu Pulse Score.</span>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon="clock">Hoy</SectionTitle>
        <div className="empleado-hoy-horas">
          <div className="empleado-hoy-hora">
            <span>Entrada</span>
            <strong>{entrada ? horaCorta(entrada.marcadaEn) : "—"}</strong>
          </div>
          <div className="empleado-hoy-hora">
            <span>Salida</span>
            <strong>{salida ? horaCorta(salida.marcadaEn) : "—"}</strong>
          </div>
        </div>
        <p className="empleado-hoy-estado">{estadoHoy}</p>
      </Card>

      <Card>
        <SectionTitle icon="dollar">Tu semana</SectionTitle>
        {!recibo || recibo.sinSueldo ? (
          <EmptyState message="Aún no tienes un sueldo semanal capturado. Pídele a Recursos Humanos que lo registre." />
        ) : (
          <>
            <div className="empleado-semana-sueldo">
              <span>Sueldo de la semana</span>
              <strong>{money(recibo.sueldo)}</strong>
            </div>
            <p className="empleado-semana-resumen">{resumenSemana}</p>

            <div className="empleado-semana-dias">
              {recibo.detalle.map((dia) => (
                <div key={dia.fecha} className="empleado-semana-dia-row">
                  <span className="empleado-semana-dia-fecha">
                    {DIA_CORTO[diaISO(dia.fecha)]} {Number(dia.fecha.slice(8, 10))}
                  </span>
                  <span className={`empleado-semana-dia-estado asistencia-calendario-celda--${dia.estado}`}>
                    {etiquetaEstadoDia(dia)}
                  </span>
                  <span className={`empleado-semana-dia-monto${dia.descuento > 0 ? " empleado-semana-dia-monto--cobra" : ""}`}>
                    {dia.descuento > 0 ? `−${money(dia.descuento)}` : "—"}
                  </span>
                </div>
              ))}
            </div>

            {recibo.descuento > 0 && (
              <div className="empleado-semana-descuento-box">
                <div>
                  <span>Se te descuenta</span>
                  <strong>{money(recibo.descuento)}</strong>
                </div>
                <div>
                  <span>Te quedaría</span>
                  <strong>{money(recibo.pagoFinal)}</strong>
                </div>
              </div>
            )}

            <p className="mc-hint">Estimado de lunes a domingo, con las mismas reglas que usa Recursos Humanos.</p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle icon="vacation">Permisos y vacaciones</SectionTitle>
        {permisosSemana.length === 0 && vacacionesSemana.length === 0 ? (
          <EmptyState message="Esta semana no tienes permisos ni vacaciones." />
        ) : (
          <div className="empleado-permisos-lista">
            {vacacionesSemana.map((v) => (
              <div key={`v-${v.id}`} className="empleado-permiso-row">
                <span className="empleado-permiso-tipo"><Icon name="vacation" size={14} /> Vacaciones</span>
                <span className="empleado-permiso-fechas">
                  {formatFechaCorta(v.fechaInicio)}{v.fechaFin && v.fechaFin !== v.fechaInicio ? ` – ${formatFechaCorta(v.fechaFin)}` : ""}
                </span>
                <Badge variant={v.estado}>{ETIQUETA_ESTADO_PILL[v.estado] || v.estado}</Badge>
              </div>
            ))}
            {permisosSemana.map((p) => (
              <div key={`p-${p.id}`} className="empleado-permiso-row">
                <span className="empleado-permiso-tipo"><Icon name="calendarDays" size={14} /> Permiso</span>
                <span className="empleado-permiso-fechas">
                  {formatFechaCorta(p.fecha)}{p.fechaFin && p.fechaFin !== p.fecha ? ` – ${formatFechaCorta(p.fechaFin)}` : ""}
                </span>
                <Badge variant={p.estado}>{ETIQUETA_ESTADO_PILL[p.estado] || p.estado}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className={`empleado-encuesta-card${yaContesto ? "" : " empleado-encuesta-card--pendiente"}`}>
        <SectionTitle icon="clipboard">Encuesta de la semana</SectionTitle>
        {yaContesto ? (
          <div className="empleado-empty-inline">
            <Icon name="check" size={18} />
            <span>Ya contestaste tu encuesta de la {etiquetaDePeriodo(periodoActual).toLowerCase()}.</span>
          </div>
        ) : (
          <>
            <p className="empleado-encuesta-texto">
              Te faltan <strong>{preguntasSemana.length}</strong> por contestar. Sin ella no podrás fichar el viernes.
            </p>
            <button
              type="button"
              className="mc-btn-primary mc-btn-with-icon"
              onClick={() => setActive("encuesta")}
            >
              <Icon name="clipboardCheck" size={16} /> Contestarla ahora
            </button>
          </>
        )}
      </Card>
    </div>
  );
};

export default InicioEmpleado;
