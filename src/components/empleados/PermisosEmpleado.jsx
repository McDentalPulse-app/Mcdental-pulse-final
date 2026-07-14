import React, { useState } from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import { CAUSAS_PERMISO } from "../../utils/permisos";

export default function PermisosEmpleado({
  user,
  vacaciones = [],
  permisos = [],
  onEnviarSolicitudEmpleado
}) {
  const { toast, confirm } = useNotification();
  const [tipoSeleccionado, setTipoSeleccionado] = useState("Vacaciones");
  const [causaSeleccionada, setCausaSeleccionada] = useState("");
  const [fechaInicioPreview, setFechaInicioPreview] = useState("");
  const [fechaFinPreview, setFechaFinPreview] = useState("");
  const [diasPreview, setDiasPreview] = useState(0);

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
    const fechaInicio = form.fechaInicio.value;
    const fechaFin =
      tipo === "Vacaciones" ? form.fechaFin.value : form.fechaInicio.value;

    if (!tipo) {
      toast.warning("Selecciona un tipo de permiso");
      return;
    }

    if (!fechaInicio) {
      toast.warning("Selecciona la fecha de inicio");
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

    const confirmar = await confirm({
      title: "Enviar solicitud",
      description: `¿Deseas enviar esta solicitud de "${tipo}"?`,
      confirmText: "Enviar solicitud",
    });

    if (!confirmar) return;

    const nuevoPermiso = {
      id: Date.now(),
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
      causa: tipo === "Permisos" ? form.causa?.value || null : null,
      motivo: form.motivo.value,
      comentario: form.comentario.value,
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
                  <label className="mc-form-label" htmlFor="pe-hora">¿A qué hora necesitas salir?</label>
                  <input id="pe-hora" className="mc-form-input" name="hora" type="time" required />
                  <p className="mc-hint">
                    <Icon name="alert" size={14} />
                    Si RH lo aprueba, podrás registrar tu salida 10 minutos antes de esa hora.
                  </p>
                </div>
              )}
            </>
          )}

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

          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="pe-motivo">Motivo</label>
            <input id="pe-motivo" className="mc-form-input" name="motivo" placeholder="Motivo de la solicitud" required />
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="pe-comentario">Comentario opcional</label>
            <input id="pe-comentario" className="mc-form-input" name="comentario" placeholder="Información adicional para RH" />
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
          <p className="admin-empty">Aún no has enviado solicitudes de vacaciones.</p>
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
