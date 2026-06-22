import React, { useState } from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";

const ReporteConfidencialEmpleado = ({ user, onSubmit }) => {
  const { toast, confirm } = useNotification();
  const [tipo, setTipo] = useState("Conflictos internos");
  const [urgencia, setUrgencia] = useState("Media");
  const [descripcion, setDescripcion] = useState("");
  const [evidencias, setEvidencias] = useState("");
  const [enviado, setEnviado] = useState(false);

  const tipos = [
    "Acoso laboral",
    "Acoso sexual",
    "Robo",
    "Fraude",
    "Maltrato",
    "Violencia",
    "Mala práctica clínica",
    "Consumo de sustancias",
    "Conflictos internos",
    "Otros"
  ];

  const enviar = async () => {
    if (!descripcion.trim()) {
      toast.warning("Por favor escribe una descripción del reporte.");
      return;
    }

    const confirmar = await confirm({
      title: "Enviar reporte confidencial",
      description: "Tu reporte será enviado de forma confidencial a la psicóloga. ¿Deseas continuar?",
      variant: "warning",
      confirmText: "Enviar reporte",
    });
    if (!confirmar) return;

    onSubmit({
      empleadoId: user.id,
      empleado: user.name,
      sucursal: user.sucursal,
      puesto: user.puesto,
      tipo,
      urgencia,
      descripcion,
      evidencias: evidencias.trim() || "Sin evidencia adjunta"
    });

    setDescripcion("");
    setEvidencias("");
    setTipo("Conflictos internos");
    setUrgencia("Media");
    setEnviado(true);
  };

  return (
    <div className="admin-page empleado-page empleado-form-narrow">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Reporte confidencial</h1>
        <p className="admin-page-subtitle">
          Este espacio permite reportar situaciones sensibles. La información será visible únicamente para Psicóloga y Admin Principal.
        </p>
      </div>

      <div className="admin-info-box psico-confidential-info empleado-confidential-info">
        <Icon name="shield" size={16} />
        <span>Tu reporte es confidencial. Será revisado con discreción y solo por personal autorizado.</span>
      </div>

      {enviado ? (
        <Card className="empleado-success-card">
          <SectionTitle icon="check">Reporte enviado</SectionTitle>
          <p className="admin-page-subtitle">
            Tu reporte fue registrado de forma confidencial para seguimiento.
          </p>
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => setEnviado(false)}>
            <Icon name="plus" size={16} /> Crear otro reporte
          </button>
        </Card>
      ) : (
        <Card className="empleado-form-card empleado-confidential-form">
          <SectionTitle icon="lock">Nuevo reporte</SectionTitle>

          <div className="mc-form-grid">
            <div className="mc-form-group">
              <label className="mc-form-label">Tipo de reporte</label>
              <select className="mc-form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="mc-form-group">
              <label className="mc-form-label">Nivel de urgencia</label>
              <select className="mc-form-select" value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
                <option>Baja</option>
                <option>Media</option>
                <option>Alta</option>
                <option>Crítica</option>
              </select>
            </div>

            <div className="mc-form-group">
              <label className="mc-form-label">Descripción</label>
              <textarea
                className="mc-form-textarea"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe lo ocurrido con el mayor detalle posible..."
                rows={5}
              />
            </div>

            <div className="mc-form-group">
              <label className="mc-form-label">Evidencias o notas adicionales</label>
              <textarea
                className="mc-form-textarea"
                value={evidencias}
                onChange={(e) => setEvidencias(e.target.value)}
                placeholder="Indica si tienes evidencias, fechas, personas involucradas o contexto adicional..."
                rows={3}
              />
            </div>

            <button type="button" className="mc-btn-primary mc-btn-with-icon empleado-confidential-submit" onClick={enviar}>
              <Icon name="lock" size={16} /> Enviar reporte confidencial
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReporteConfidencialEmpleado;
