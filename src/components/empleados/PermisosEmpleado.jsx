import React, { useState } from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import { CAUSAS_PERMISO, CAUSA_SALIDA_ANTICIPADA } from "../../utils/permisos";
import { minutosNoTrabajados, formatoDuracion, diaISO, TZ_CLINICA } from "../../utils/asistencia";

const hoyClinica = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(new Date());

export default function PermisosEmpleado({
  user,
  vacaciones = [],
  permisos = [],
  horarios = [],
  onEnviarSolicitudEmpleado
}) {
  const { toast, confirm } = useNotification();
  const [tipoSeleccionado, setTipoSeleccionado] = useState("Vacaciones");
  const [causaSeleccionada, setCausaSeleccionada] = useState("");
  const [horaPreview, setHoraPreview] = useState("");
  const [fechaInicioPreview, setFechaInicioPreview] = useState("");
  const [fechaFinPreview, setFechaFinPreview] = useState("");
  const [diasPreview, setDiasPreview] = useState(0);

  // Una salida anticipada es SIEMPRE hoy y SIEMPRE un solo día: pedirle "fecha de inicio" y
  // "fecha de fin (si dura varios días)" para decir "me voy a las 3" era hacerle rellenar
  // campos que no significan nada.
  const esSalidaAnticipada = tipoSeleccionado === "Permisos" && causaSeleccionada === CAUSA_SALIDA_ANTICIPADA;

  // El turno de HOY, para poder decirle cuánto se le va a descontar.
  const turnoHoy = horarios.find(
    (h) => h.empleadoId === user?.id && h.diaSemana === diaISO(hoyClinica())
  ) || null;

  const minutosDescuento = esSalidaAnticipada ? minutosNoTrabajados(horaPreview, turnoHoy) : 0;

  const calcularDias = (inicio, fin) => {
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);
    return Math.floor((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleFechaChange = (inicio, fin) => {
    if (inicio && fin) {
      const dias = calcularDias(inicio, fin);
      setDiasPreview(dias > 0 ? dias : 0);
    } else {
      setDiasPreview(0);
    }
  };

  // Los PERMISOS también, no solo las vacaciones.
  //
  // La prop `permisos` llegaba aquí y no se usaba: el empleado solicitaba un permiso y
  // desaparecía de su vista — no podía saber si se lo habían aprobado. Daba igual mientras
  // el formulario no dejaba pedir permisos (el tipo estaba fijo en "Vacaciones"), pero
  // ahora sí, y sin esto un permiso de salida anticipada se enviaría a un agujero negro.
  const solicitudesEmpleado = [
    ...vacaciones
      .filter((v) => v.empleadoId === user?.id)
      .map((v) => ({ ...v, tipo: "Vacaciones" })),
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

    const form = e.target;
    const tipo = form.tipo.value;
    const causa = tipo === "Permisos" ? form.causa?.value || null : null;
    const salidaAnticipada = causa === CAUSA_SALIDA_ANTICIPADA;

    // Una salida anticipada es hoy. No se le pregunta la fecha: se la ponemos nosotros.
    const fechaInicio = salidaAnticipada ? hoyClinica() : form.fechaInicio.value;
    const fechaFin =
      salidaAnticipada ? fechaInicio
      : tipo === "Vacaciones" ? form.fechaFin.value
      : form.fechaInicio.value;

    if (!tipo) {
      toast.warning("Selecciona un tipo de permiso");
      return;
    }

    if (!fechaInicio) {
      toast.warning("Selecciona la fecha de inicio");
      return;
    }

    if (salidaAnticipada && !turnoHoy) {
      toast.warning("Hoy no tienes turno asignado, así que no hay salida que adelantar.");
      return;
    }

    if (tipo === "Vacaciones" && !fechaFin) {
      toast.warning("Selecciona la fecha de fin");
      return;
    }

    let dias = 1;

    if (tipo === "Vacaciones") {
      dias = calcularDias(fechaInicio, fechaFin);

      if (dias <= 0) {
        toast.warning("La fecha final debe ser igual o posterior a la fecha inicial.");
        return;
      }
    }

    // El aviso del descuento va AQUÍ, antes de enviar, y con el número exacto. Enterarse en
    // la nómina de que salir dos horas antes costó dinero es la peor forma posible de
    // descubrir una regla — y la que hace que la gente deje de confiar en la herramienta.
    const confirmar = await confirm(
      salidaAnticipada
        ? {
            title: "Salida anticipada",
            description:
              `Tu turno de hoy termina a las ${turnoHoy.horaSalida.slice(0, 5)} y pides salir a las ` +
              `${form.hora.value}. Si Recursos Humanos lo aprueba, se te descontarán las ` +
              `${formatoDuracion(minutosDescuento)} que dejes de trabajar. ¿Quieres enviar la solicitud?`,
            variant: "warning",
            confirmText: "Sí, enviar la solicitud",
          }
        : {
            title: "Enviar solicitud",
            description: `¿Deseas enviar esta solicitud de "${tipo}"?`,
            confirmText: "Enviar solicitud",
          }
    );

    if (!confirmar) return;

    const nuevoPermiso = {
      // Sin `id`: lo genera la base (uuid). El que se ponía aquí con Date.now() no lo usaba
      // nadie — el servicio manda el insert y devuelve la fila real, con su id de verdad.
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
      hora: form.hora?.value || "",
      dias: tipo === "Vacaciones" ? dias : "",
      causa,
      motivo: form.motivo.value,
      comentario: "",
      estado: "pendiente",
      origen: "empleado"
    };

    if (onEnviarSolicitudEmpleado) {
      onEnviarSolicitudEmpleado(nuevoPermiso);
    }

    toast.success("Solicitud enviada correctamente a RH.");

    form.reset();
    setTipoSeleccionado("Vacaciones");
    setCausaSeleccionada("");
    setHoraPreview("");
    setFechaInicioPreview("");
    setFechaFinPreview("");
    setDiasPreview(0);
  };

  return (
    <div className="admin-page empleado-page empleado-form-narrow">
      <PageHeader
        icon="vacation"
        title="Vacaciones y permisos"
        subtitle="Solicita días de descanso o un permiso. RH revisará tu petición y te notificará el estatus."
      />

      <Card className="empleado-form-card">
        <SectionTitle icon="vacation">Nueva solicitud</SectionTitle>

        <form
          className="mc-form-grid"
          onSubmit={handleSubmit}
        >
          {/* Esto era un <input type="hidden" value="Vacaciones">, así que la rama de
              permisos de addSolicitudEmpleadoRH era código inalcanzable y NADIE podía
              solicitar un permiso desde la app. Ahora el empleado elige de verdad. */}
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="pe-tipo">Tipo de solicitud</label>
            <select
              id="pe-tipo"
              className="mc-form-input"
              name="tipo"
              value={tipoSeleccionado}
              onChange={(e) => setTipoSeleccionado(e.target.value)}
            >
              <option value="Vacaciones">Vacaciones</option>
              <option value="Permisos">Permiso</option>
            </select>
          </div>

          {tipoSeleccionado === "Permisos" && (
            <>
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="pe-causa">Causa</label>
                <select
                  id="pe-causa"
                  className="mc-form-input"
                  name="causa"
                  required
                  value={causaSeleccionada}
                  onChange={(e) => setCausaSeleccionada(e.target.value)}
                >
                  <option value="">Selecciona una causa</option>
                  {CAUSAS_PERMISO.map((c) => (
                    <option key={c.valor} value={c.valor}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* La hora solo se pide cuando significa algo. Para una salida anticipada NO es
                  un dato informativo: es la hora a partir de la cual el checador le dejará
                  registrar su salida (migración 045). */}
              {CAUSAS_PERMISO.find((c) => c.valor === causaSeleccionada)?.pideHora && (
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
                    // El descuento se le enseña EN VIVO, mientras elige la hora, no al final.
                    // Así puede ver que salir a las 5 en vez de a las 3 le cuesta la mitad.
                    <p className="checador-pill checador-pill--alerta">
                      <Icon name="alert" size={15} />
                      Tu turno termina a las {turnoHoy.horaSalida.slice(0, 5)}. Se te descontarán las{" "}
                      <strong>{formatoDuracion(minutosDescuento)}</strong> que dejes de trabajar.
                    </p>
                  ) : (
                    <p className="mc-hint">
                      <Icon name="alert" size={14} />
                      Si RH lo aprueba, podrás registrar tu salida 10 minutos antes de esa hora.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {!esSalidaAnticipada && (
          <div className="mc-form-row-2">
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="pe-fecha-inicio">Fecha de inicio</label>
              <input
                id="pe-fecha-inicio"
                className="mc-form-input"
                name="fechaInicio"
                type="date"
                required
                value={fechaInicioPreview}
                onChange={(e) => {
                  setFechaInicioPreview(e.target.value);
                  handleFechaChange(e.target.value, fechaFinPreview);
                }}
              />
            </div>

            {/* La fecha de fin ya no es solo de vacaciones: un permiso también puede durar
                varios días (una incapacidad de tres días es UN permiso, no tres). Para un
                permiso de un solo día se deja vacía y la base guarda fecha_fin = null. */}
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="pe-fecha-fin">
                {tipoSeleccionado === "Vacaciones" ? "Fecha de fin" : "Fecha de fin (si dura varios días)"}
              </label>
              <input
                id="pe-fecha-fin"
                className="mc-form-input"
                name="fechaFin"
                type="date"
                min={fechaInicioPreview || undefined}
                value={fechaFinPreview}
                onChange={(e) => {
                  setFechaFinPreview(e.target.value);
                  handleFechaChange(fechaInicioPreview, e.target.value);
                }}
              />
            </div>
          </div>
          )}

          {/* En un permiso, la CAUSA ya dice por qué. Un "Motivo" de texto libre obligatorio
              encima era pedirle que lo escribiera dos veces — y un tercer campo de
              "Comentario opcional" que hacía exactamente lo mismo. Se queda uno solo, y es
              obligatorio únicamente en vacaciones, donde no hay causa que lo explique. */}
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="pe-motivo">
              {tipoSeleccionado === "Vacaciones" ? "Motivo" : "Detalle para RH (opcional)"}
            </label>
            <input
              id="pe-motivo"
              className="mc-form-input"
              name="motivo"
              placeholder={tipoSeleccionado === "Vacaciones" ? "Motivo de la solicitud" : "Algo que RH deba saber"}
              required={tipoSeleccionado === "Vacaciones"}
            />
          </div>

          {tipoSeleccionado === "Vacaciones" && diasPreview > 0 && (
            <div className="admin-info-box empleado-days-hint">
              <Icon name="calendar" size={14} />
              <span>Días solicitados: <strong>{diasPreview}</strong></span>
            </div>
          )}

          <button type="submit" className="mc-btn-primary mc-btn-with-icon">
            <Icon name="check" size={16} /> Enviar solicitud
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle icon="clipboard">Mis solicitudes</SectionTitle>

        {solicitudesEmpleado.length === 0 ? (
          <p className="admin-empty">Aún no has enviado ninguna solicitud.</p>
        ) : (
          <div className="empleado-solicitud-list">
            {solicitudesEmpleado.map((p) => (
              <div key={p.id} className="empleado-solicitud-item">
                <div className="empleado-solicitud-main">
                  <div className="empleado-solicitud-title">{p.tipo}</div>
                  <div className="empleado-solicitud-dates">
                    {p.tipo === "Vacaciones"
                      ? `${p.fechaInicio || p.inicio || p.desde} al ${p.fechaFin || p.fin || p.hasta} · ${p.dias} días`
                      : `${p.fecha || p.fechaInicio} ${p.hora || ""}`}
                  </div>
                  <div className="empleado-solicitud-motivo">{p.motivo}</div>
                  {p.comentario && (
                    <div className="empleado-solicitud-note">{p.comentario}</div>
                  )}
                  {p.comentarioRH && (
                    <div className="empleado-solicitud-rh">Comentario RH: {p.comentarioRH}</div>
                  )}
                </div>
                <span className={`mc-status-pill ${estadoClass(p.estado)}`}>{p.estado}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
