import React, { useState } from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";

export default function PermisosEmpleado({
  user,
  vacaciones = [],
  permisos = [],
  onEnviarSolicitudEmpleado
}) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState("Vacaciones");
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

  const solicitudesEmpleado = [
    ...vacaciones
      .filter((v) => v.empleadoId === user?.id)
      .map((v) => ({
        ...v,
        tipo: "Vacaciones"
      }))
  ].sort((a, b) => Number(b.id) - Number(a.id));

  const estadoClass = (estado) => {
    const e = String(estado || "").toLowerCase();
    if (e === "aprobada" || e === "aprobado") return "mc-status-pill--aprobada";
    if (e === "rechazada" || e === "rechazado") return "mc-status-pill--rechazada";
    return "mc-status-pill--pendiente";
  };

  return (
    <div className="admin-page empleado-page empleado-page--narrow">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Vacaciones</h1>
        <p className="admin-page-subtitle">
          Solicita días de descanso. RH revisará tu petición y te notificará el estatus.
        </p>
      </div>

      <Card className="empleado-form-card">
        <SectionTitle icon="vacation">Nueva solicitud</SectionTitle>

        <form
          className="mc-form-grid"
          onSubmit={(e) => {
            e.preventDefault();

            const form = e.target;
            const tipo = form.tipo.value;
            const fechaInicio = form.fechaInicio.value;
            const fechaFin =
              tipo === "Vacaciones" ? form.fechaFin.value : form.fechaInicio.value;

            if (!tipo) {
              alert("Selecciona un tipo de permiso");
              return;
            }

            if (!fechaInicio) {
              alert("Selecciona la fecha de inicio");
              return;
            }

            if (tipo === "Vacaciones" && !fechaFin) {
              alert("Selecciona la fecha de fin");
              return;
            }

            let dias = 1;

            if (tipo === "Vacaciones") {
              dias = calcularDias(fechaInicio, fechaFin);

              if (dias <= 0) {
                alert("La fecha final debe ser igual o posterior a la fecha inicial.");
                return;
              }
            }

            const confirmar = window.confirm(
              `¿Deseas enviar esta solicitud de "${tipo}"?`
            );

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
              hora: "",
              dias: tipo === "Vacaciones" ? dias : "",
              motivo: form.motivo.value,
              comentario: form.comentario.value,
              estado: "pendiente",
              origen: "empleado"
            };

            if (onEnviarSolicitudEmpleado) {
              onEnviarSolicitudEmpleado(nuevoPermiso);
            }

            alert("Solicitud enviada correctamente a RH.");

            form.reset();
            setTipoSeleccionado("Vacaciones");
            setFechaInicioPreview("");
            setFechaFinPreview("");
            setDiasPreview(0);
          }}
        >
          <input type="hidden" name="tipo" value="Vacaciones" />

          <div className="mc-form-row-2">
            <div className="mc-form-group">
              <label className="mc-form-label">Fecha de inicio</label>
              <input
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

            {tipoSeleccionado === "Vacaciones" && (
              <div className="mc-form-group">
                <label className="mc-form-label">Fecha de fin</label>
                <input
                  className="mc-form-input"
                  name="fechaFin"
                  type="date"
                  value={fechaFinPreview}
                  onChange={(e) => {
                    setFechaFinPreview(e.target.value);
                    handleFechaChange(fechaInicioPreview, e.target.value);
                  }}
                />
              </div>
            )}
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Motivo</label>
            <input className="mc-form-input" name="motivo" placeholder="Motivo de la solicitud" required />
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Comentario opcional</label>
            <input className="mc-form-input" name="comentario" placeholder="Información adicional para RH" />
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
