import { useState } from "react";
import Select from "../common/Select";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import DateRangePicker from "../common/DateRangePicker";
import { useNotification } from "../../contexts/NotificationContext";
import { CAUSAS_PERMISO, CAUSA_SALIDA_ANTICIPADA } from "../../utils/permisos";
import { saldoVacaciones, validarSolicitud, DIAS_VACACIONES_POR_ANIO } from "../../utils/vacaciones";
import { formatFechaCorta } from "../../utils/helpers";

// El util devuelve el motivo y el periodo culpable; la frase se compone aquí, que es donde
// se sabe cómo se escriben las fechas para una persona.
const avisoVacaciones = (v) => {
  switch (v.motivo) {
    case "sin_ingreso":
      return "RH aún no tiene registrada tu fecha de ingreso, así que no se puede calcular tu derecho a vacaciones. Avísales para que la capturen.";
    case "bloqueado":
      return `Tus vacaciones se desbloquean el ${formatFechaCorta(v.proximoAniversario)}, al cumplir tu primer año. Mientras tanto puedes solicitar un permiso.`;
    case "agotado":
      return `Ya usaste tus ${DIAS_VACACIONES_POR_ANIO} días del periodo que termina el ${formatFechaCorta(v.periodo.fin)}.`;
    case "excede":
      return `Solo te quedan ${v.disponibles} ${v.disponibles === 1 ? "día" : "días"} en el periodo que termina el ${formatFechaCorta(v.periodo.fin)}, y ahí caen ${v.pide} de los que pides.`;
    case "rango":
      return "La fecha final debe ser igual o posterior a la fecha inicial.";
    default:
      return "Selecciona las fechas de tus vacaciones.";
  }
};
import { minutosNoTrabajados, formatoDuracion, diaISO, TZ_CLINICA } from "../../utils/asistencia";

const hoyClinica = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(new Date());

const MES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Fecha legible en español: "10 ago". Un rango con el mismo mes se compacta a "10–12 ago".
const fechaCorta = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${MES_ABR[d.getMonth()]}`;
};
const rangoCorto = (ini, fin) => {
  if (!ini) return "";
  if (!fin || fin === ini) return fechaCorta(ini);
  const a = new Date(`${ini}T00:00:00`), b = new Date(`${fin}T00:00:00`);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ${MES_ABR[b.getMonth()]}`;
  }
  return `${fechaCorta(ini)} – ${fechaCorta(fin)}`;
};

export default function PermisosEmpleado({
  user,
  vacaciones = [],
  permisos = [],
  horarios = [],
  onEnviarSolicitudEmpleado,
  autoAprobar = false, // gestión (RH/psicóloga) se auto-agenda: crea ya aprobado, sin pedir a RH
}) {
  const { toast, confirm } = useNotification();
  const [tipoSeleccionado, setTipoSeleccionado] = useState("Vacaciones");
  const [causaSeleccionada, setCausaSeleccionada] = useState("");
  const [horaPreview, setHoraPreview] = useState("");
  const [motivoPreview, setMotivoPreview] = useState("");
  // Las fechas arrancan en HOY para que el selector visual tenga siempre un valor válido que
  // mostrar (en vez de un "mm/dd/aaaa" vacío). El usuario ajusta el rango con clics.
  const [fechaInicioPreview, setFechaInicioPreview] = useState(hoyClinica());
  const [fechaFinPreview, setFechaFinPreview] = useState(hoyClinica());

  // Una salida anticipada es SIEMPRE hoy y SIEMPRE un solo día: no se le piden fechas.
  const esSalidaAnticipada = tipoSeleccionado === "Permisos" && causaSeleccionada === CAUSA_SALIDA_ANTICIPADA;

  // El turno de HOY, para poder decirle cuánto se le va a descontar.
  const turnoHoy = horarios.find(
    (h) => h.empleadoId === user?.id && h.diaSemana === diaISO(hoyClinica())
  ) || null;

  const minutosDescuento = esSalidaAnticipada ? minutosNoTrabajados(horaPreview, turnoHoy) : 0;

  const calcularDias = (inicio, fin) => {
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin || inicio);
    return Math.floor((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
  };
  const diasPreview = fechaInicioPreview ? Math.max(0, calcularDias(fechaInicioPreview, fechaFinPreview)) : 0;

  const elegirTipo = (tipo) => {
    setTipoSeleccionado(tipo);
    if (tipo === "Vacaciones") setCausaSeleccionada("");
  };

  const vacacionesEmpleado = vacaciones.filter((v) => v.empleadoId === user?.id);

  // Gestión (RH/psicóloga) se auto-agenda y queda fuera de la regla: no se le mide antigüedad
  // ni se le descuentan días. Para el empleado, las vacaciones se desbloquean al año y son 8
  // por periodo aniversario (utils/vacaciones.js).
  const saldo = autoAprobar ? null : saldoVacaciones(user?.fechaIngreso, vacacionesEmpleado, hoyClinica());
  const pideVacaciones = tipoSeleccionado === "Vacaciones";

  // Se valida el rango ELEGIDO, no solo el saldo de hoy: unas vacaciones a caballo del
  // aniversario gastan de los dos periodos y tienen que caber en los dos.
  const validacion = saldo && pideVacaciones
    ? validarSolicitud(user?.fechaIngreso, vacacionesEmpleado, fechaInicioPreview, fechaFinPreview, hoyClinica())
    : { ok: true };

  // Los PERMISOS también, no solo las vacaciones: sin esto un permiso enviado desaparecía de la
  // vista del empleado y no podía saber si se lo habían aprobado.
  const solicitudesEmpleado = [
    ...vacacionesEmpleado.map((v) => ({ ...v, tipo: "Vacaciones" })),
    ...permisos
      .filter((p) => p.empleadoId === user?.id)
      .map((p) => ({ ...p, tipo: "Permiso", fechaInicio: p.fecha, fechaFin: p.fechaFin || p.fecha })),
  ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const estadoClass = (estado) => {
    const e = String(estado || "").toLowerCase();
    if (e === "aprobada" || e === "aprobado") return "mc-status-pill--aprobada";
    if (e === "rechazada" || e === "rechazado") return "mc-status-pill--rechazada";
    return "mc-status-pill--pendiente";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const tipo = tipoSeleccionado;
    const causa = tipo === "Permisos" ? causaSeleccionada || null : null;
    const salidaAnticipada = causa === CAUSA_SALIDA_ANTICIPADA;

    // Una salida anticipada es hoy. No se le pregunta la fecha: se la ponemos nosotros.
    const fechaInicio = salidaAnticipada ? hoyClinica() : fechaInicioPreview;
    const fechaFin =
      salidaAnticipada ? fechaInicio
      : tipo === "Vacaciones" ? fechaFinPreview
      : (fechaFinPreview || fechaInicioPreview);

    if (tipo === "Permisos" && !causa) {
      toast.warning("Selecciona la causa del permiso.");
      return;
    }
    if (!fechaInicio) {
      toast.warning("Selecciona la fecha.");
      return;
    }
    if (salidaAnticipada && !turnoHoy) {
      toast.warning("Hoy no tienes turno asignado, así que no hay salida que adelantar.");
      return;
    }

    let dias = 1;
    if (tipo === "Vacaciones") {
      dias = calcularDias(fechaInicio, fechaFin);
      if (dias <= 0) {
        toast.warning("La fecha final debe ser igual o posterior a la fecha inicial.");
        return;
      }
      // El candado de verdad está en la base (migración 162); esto evita que se envíe una
      // solicitud que ya se sabe que no procede y que el empleado se entere días después.
      if (saldo) {
        const veredicto = validarSolicitud(user?.fechaIngreso, vacacionesEmpleado, fechaInicio, fechaFin, hoyClinica());
        if (!veredicto.ok) {
          toast.warning(avisoVacaciones(veredicto));
          return;
        }
      }
    }

    // El aviso del descuento va AQUÍ, antes de enviar, con el número exacto.
    const confirmar = await confirm(
      salidaAnticipada
        ? {
            title: "Salida anticipada",
            description:
              `Tu turno de hoy termina a las ${turnoHoy.horaSalida.slice(0, 5)} y pides salir a las ` +
              `${horaPreview}. Si Recursos Humanos lo aprueba, se te descontarán las ` +
              `${formatoDuracion(minutosDescuento)} que dejes de trabajar. ¿Quieres enviar la solicitud?`,
            variant: "warning",
            confirmText: "Sí, enviar la solicitud",
          }
        : {
            title: autoAprobar ? "Agendar" : "Enviar solicitud",
            description: autoAprobar
              ? `¿Agendar estos días de "${tipo}"? Quedarán registrados como aprobados.`
              : `¿Deseas enviar esta solicitud de "${tipo}"?`,
            confirmText: autoAprobar ? "Agendar" : "Enviar solicitud",
          }
    );

    if (!confirmar) return;

    const nuevoPermiso = {
      tipo,
      empleadoId: user?.id,
      empleado: user?.name || "Empleado",
      nombre: user?.name || "Empleado",
      name: user?.name || "Empleado",
      sucursal: user?.sucursal || "Sin sucursal",
      puesto: user?.puesto || user?.categoria || "Empleado",
      categoria: user?.categoria || user?.puesto || "Empleado",
      fecha: fechaInicio,
      fechaInicio,
      fechaFin,
      inicio: fechaInicio,
      fin: fechaFin,
      desde: fechaInicio,
      hasta: fechaFin,
      hora: horaPreview || "",
      dias: tipo === "Vacaciones" ? dias : "",
      causa,
      motivo: motivoPreview,
      comentario: "",
      estado: "pendiente",
      origen: "empleado",
    };

    if (onEnviarSolicitudEmpleado) {
      onEnviarSolicitudEmpleado(nuevoPermiso);
    }

    toast.success(autoAprobar ? "Agendado correctamente." : "Solicitud enviada correctamente a RH.");

    setTipoSeleccionado("Vacaciones");
    setCausaSeleccionada("");
    setHoraPreview("");
    setMotivoPreview("");
    setFechaInicioPreview(hoyClinica());
    setFechaFinPreview(hoyClinica());
  };

  const pideHora = CAUSAS_PERMISO.find((c) => c.valor === causaSeleccionada)?.pideHora;

  return (
    <div className="admin-page empleado-page empleado-form-narrow">
      <PageHeader
        icon="vacation"
        title="Vacaciones y permisos"
        subtitle={autoAprobar
          ? "Agenda tus propios días de descanso o permisos. Quedan registrados como aprobados."
          : "Solicita días de descanso o un permiso. RH revisará tu petición y te notificará el estatus."}
      />

      <Card className="empleado-form-card">
        <SectionTitle icon="vacation">Nueva solicitud</SectionTitle>

        <form className="mc-form-grid" onSubmit={handleSubmit}>
          {/* Tipo como dos tarjetas grandes, en vez de un desplegable: se ve de un vistazo qué
              estás pidiendo, y cada opción explica qué es. */}
          <div className="mc-form-group">
            <label className="mc-form-label">Tipo de solicitud</label>
            <div className="solicitud-tipo-grid">
              {[
                { valor: "Vacaciones", icono: "vacation", titulo: "Vacaciones", sub: "Días de descanso" },
                { valor: "Permisos", icono: "clipboardCheck", titulo: "Permiso", sub: "Ausencia puntual o salida" },
              ].map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  className={`solicitud-tipo-card${tipoSeleccionado === op.valor ? " solicitud-tipo-card--activa" : ""}`}
                  aria-pressed={tipoSeleccionado === op.valor}
                  onClick={() => elegirTipo(op.valor)}
                >
                  <span className="solicitud-tipo-ico"><Icon name={op.icono} size={20} /></span>
                  <span className="solicitud-tipo-txt">
                    <strong>{op.titulo}</strong>
                    <span>{op.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Qué días le quedan, antes de que elija fechas. Sin esto, la única forma de saber
              que no tenía derecho era enviar la solicitud y esperar a que RH la rechazara. */}
          {saldo && pideVacaciones && (
            <>
              {saldo.desbloqueado && (
                <div className="admin-info-box empleado-days-hint">
                  <Icon name="vacation" size={16} />
                  <span>
                    Te quedan <strong>{saldo.disponibles}</strong> de {saldo.total} días en tu
                    periodo actual (hasta el {formatFechaCorta(saldo.periodo.fin)}).
                  </span>
                </div>
              )}
              {!validacion.ok && (
                <div className="aviso-descuento">
                  <Icon name="alert" size={16} />
                  <span>{avisoVacaciones(validacion)}</span>
                </div>
              )}
            </>
          )}

          {tipoSeleccionado === "Permisos" && (
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="pe-causa">Causa</label>
              <Select
                id="pe-causa"
                name="causa"
                required
                value={causaSeleccionada}
                onChange={(valor) => setCausaSeleccionada(valor)}
              >
                <option value="">Selecciona una causa</option>
                {CAUSAS_PERMISO.map((c) => (
                  <option key={c.valor} value={c.valor}>{c.label}</option>
                ))}
              </Select>
            </div>
          )}

          {/* La hora solo se pide cuando significa algo (salida anticipada): es la hora a partir
              de la cual el checador le dejará registrar su salida. */}
          {tipoSeleccionado === "Permisos" && pideHora && (
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="pe-hora">¿A qué hora necesitas salir hoy?</label>
              <input
                id="pe-hora"
                className="mc-form-input"
                name="hora"
                type="time"
                required
                value={horaPreview}
                onChange={(e) => setHoraPreview(e.target.value)}
              />
              {!turnoHoy ? (
                <p className="mc-hint">
                  <Icon name="alert" size={14} />
                  Hoy no tienes turno asignado, así que no hay salida que adelantar.
                </p>
              ) : minutosDescuento > 0 ? (
                <div className="aviso-descuento">
                  <Icon name="alert" size={16} />
                  <span>
                    Tu turno termina a las <strong>{turnoHoy.horaSalida.slice(0, 5)}</strong>.
                    {" "}Se te descontarán <strong>{formatoDuracion(minutosDescuento)}</strong>{" "}
                    que dejes de trabajar.
                  </span>
                </div>
              ) : (
                <p className="mc-hint">
                  <Icon name="alert" size={14} />
                  Si RH lo aprueba, podrás registrar tu salida 10 minutos antes de esa hora.
                </p>
              )}
            </div>
          )}

          {/* Fechas con selector visual (calendario), en vez de campos mm/dd/aaaa. Para vacaciones
              es un rango; para un permiso de varios días también (un mismo día = inicio == fin). La
              salida anticipada es hoy, así que no muestra selector. */}
          {!esSalidaAnticipada && (
            <div className="mc-form-group">
              <label className="mc-form-label">
                {tipoSeleccionado === "Vacaciones" ? "Fechas de tus vacaciones" : "Fecha(s) del permiso"}
              </label>
              <DateRangePicker
                desde={fechaInicioPreview}
                hasta={fechaFinPreview}
                onChange={(d, h) => { setFechaInicioPreview(d); setFechaFinPreview(h); }}
              />
              {diasPreview > 0 && (
                <div className="admin-info-box empleado-days-hint">
                  <Icon name="calendar" size={14} />
                  <span>
                    {rangoCorto(fechaInicioPreview, fechaFinPreview)} · <strong>{diasPreview}</strong>{" "}
                    {diasPreview === 1 ? "día" : "días"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* En un permiso la CAUSA ya dice por qué; el detalle es opcional. En vacaciones no hay
              causa, así que el motivo es obligatorio. */}
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="pe-motivo">
              {tipoSeleccionado === "Vacaciones" ? "Motivo" : "Detalle para RH (opcional)"}
            </label>
            <input
              id="pe-motivo"
              className="mc-form-input"
              name="motivo"
              value={motivoPreview}
              onChange={(e) => setMotivoPreview(e.target.value)}
              placeholder={tipoSeleccionado === "Vacaciones" ? "Motivo de la solicitud" : "Algo que RH deba saber"}
              required={tipoSeleccionado === "Vacaciones"}
            />
          </div>

          <button
            type="submit"
            className="mc-btn-primary mc-btn-with-icon"
            disabled={!validacion.ok}
          >
            <Icon name="check" size={16} /> {autoAprobar ? "Agendar" : "Enviar solicitud"}
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle icon="clipboard">Mis solicitudes</SectionTitle>

        {solicitudesEmpleado.length === 0 ? (
          <EmptyState message="Aún no has enviado ninguna solicitud." />
        ) : (
          <div className="empleado-solicitud-list">
            {solicitudesEmpleado.map((p) => {
              const esVac = p.tipo === "Vacaciones";
              const ini = p.fechaInicio || p.inicio || p.desde || p.fecha;
              const fin = p.fechaFin || p.fin || p.hasta;
              const fechaTxt = esVac
                ? `${rangoCorto(ini, fin)} · ${p.dias} ${p.dias === 1 ? "día" : "días"}`
                : `${rangoCorto(ini, fin)}${p.hora ? ` · ${p.hora}` : ""}`;
              return (
                <div key={p.id} className="empleado-solicitud-item">
                  <span className="solicitud-tipo-ico solicitud-tipo-ico--sm">
                    <Icon name={esVac ? "vacation" : "clipboardCheck"} size={17} />
                  </span>
                  <div className="empleado-solicitud-main">
                    <div className="empleado-solicitud-title">{p.tipo}</div>
                    <div className="empleado-solicitud-dates">{fechaTxt}</div>
                    {p.motivo && <div className="empleado-solicitud-motivo">{p.motivo}</div>}
                    {p.comentarioRH && (
                      <div className="empleado-solicitud-rh">Comentario RH: {p.comentarioRH}</div>
                    )}
                  </div>
                  <span className={`mc-status-pill ${estadoClass(p.estado)}`}>{p.estado}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
