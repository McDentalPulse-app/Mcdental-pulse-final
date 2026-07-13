import React from "react";
import Icon from "../ui/Icon";
import Badge from "../common/Badge";
import { getPulseStatus, tieneScoreValido } from "../../utils/pulseScore";
import { formatSemanaDisplay } from "../../utils/constants";
import {
  buildEncuestaDetalleItems,
  getEncuestaSemaforo,
  formatEncuestaFecha,
} from "../../utils/encuestaDetail";
import { nivelColor, nivelBadgeBg } from "../../config/theme";

const EncuestaDetalleModal = ({ encuesta, empleado, preguntas, onClose }) => {
  if (!encuesta) return null;

  const score = tieneScoreValido(encuesta.score) ? Number(encuesta.score) : null;
  const status = getPulseStatus(score);
  const semaforo = getEncuestaSemaforo(encuesta);
  const items = buildEncuestaDetalleItems(encuesta, preguntas);

  return (
    <div className="mc-modal-overlay encuesta-detalle-overlay" onClick={onClose}>
      <div
        className="mc-modal encuesta-detalle-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="encuesta-detalle-title"
      >
        <div className="encuesta-detalle-header">
          <div>
            <h2 id="encuesta-detalle-title" className="mc-modal-title">Detalle de encuesta</h2>
            <p className="admin-page-subtitle encuesta-detalle-sub">
              {empleado?.name} · Semana {formatSemanaDisplay(encuesta.semana)}
              {encuesta.fecha ? ` · ${encuesta.fecha}` : ""}
            </p>
          </div>
          <button type="button" className="encuesta-detalle-close" onClick={onClose} aria-label="Cerrar">
            <Icon name="xCircle" size={20} />
          </button>
        </div>

        <div className="encuesta-detalle-kpis">
          <div
            className="encuesta-detalle-pulse"
            style={{ background: nivelBadgeBg(status.nivel), borderColor: `${nivelColor(status.nivel)}33` }}
          >
            <div className="encuesta-detalle-pulse-label" style={{ color: nivelColor(status.nivel) }}>Pulse Score</div>
            <div className="encuesta-detalle-pulse-value" style={{ color: nivelColor(status.nivel) }}>
              {score ?? "—"}
            </div>
            <div className="encuesta-detalle-pulse-status" style={{ color: nivelColor(status.nivel) }}>{status.label}</div>
          </div>

          <div className="encuesta-detalle-meta-box">
            <div><strong>Semáforo:</strong> <Badge tipo={semaforo} /></div>
            <div><strong>Fecha de respuesta:</strong> {formatEncuestaFecha(encuesta)}</div>
            <div><strong>Semana:</strong> {formatSemanaDisplay(encuesta.semana) || "—"}</div>
          </div>
        </div>

        <div className="encuesta-detalle-section">
          <h3 className="encuesta-detalle-section-title">Preguntas y respuestas</h3>
          {items.length === 0 ? (
            <p className="admin-empty">No hay respuestas detalladas registradas para esta encuesta.</p>
          ) : (
            <div className="encuesta-detalle-list">
              {items.map((item, idx) => (
                <div
                  key={`${item.pregunta}-${idx}`}
                  className={`encuesta-detalle-item${item.esAbierta ? " encuesta-detalle-item--abierta" : ""}`}
                >
                  <div className="encuesta-detalle-item-head">
                    <span className="encuesta-detalle-area">{item.area}</span>
                    {item.revisar && <span className="encuesta-detalle-chip">Revisar</span>}
                  </div>
                  <div className="encuesta-detalle-pregunta">
                    {item.numero ? `${item.numero}. ` : ""}
                    {item.pregunta}
                  </div>
                  {item.esAbierta ? (
                    <div className="encuesta-detalle-comentario-box">{item.display}</div>
                  ) : (
                    <div className="encuesta-detalle-respuesta">{item.display}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="encuesta-detalle-footer">
          <button type="button" className="mc-btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EncuestaDetalleModal;
