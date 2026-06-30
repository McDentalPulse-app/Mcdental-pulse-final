import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import { getPreguntasActivas, DEFAULT_OPCIONES_RIESGO } from "../../utils/encuestaPreguntas";
import { semanaActual, isSemanaActual } from "../../utils/constants";

const EncuestaEmpleado = ({ user, encuestas = [], onSubmit }) => {
  const { encuestaPreguntas: ENCUESTA_PREGUNTAS } = useGlobal();
  const { toast, confirm } = useNotification();

  const yaContesto = encuestas.some(
    (e) => e.empleadoId === user.id && isSemanaActual(e.semana)
  );

  const [respuestas, setRespuestas] = useState({});
  const [enviada, setEnviada] = useState(false);

  const preguntas = getPreguntasActivas(ENCUESTA_PREGUNTAS);

  const setR = (id, val) => {
    setRespuestas((prev) => ({
      ...prev,
      [id]: val
    }));
  };

  const allAnswered = preguntas.every(
    (p) => respuestas[p.id] !== undefined && respuestas[p.id] !== ""
  );

  const answeredCount = preguntas.filter(
    (p) => respuestas[p.id] !== undefined && respuestas[p.id] !== ""
  ).length;

  const progressPct = preguntas.length
    ? Math.round((answeredCount / preguntas.length) * 100)
    : 0;

  const handleSubmit = async () => {
    const preguntasConScore = preguntas.filter((p) => p.tipo === "escala");

    const valoresNumericos = preguntasConScore
      .map((p) => Number(respuestas[p.id]))
      .filter((valor) => Number.isFinite(valor));

    if (valoresNumericos.length !== preguntasConScore.length) {
      toast.warning("Faltan respuestas numéricas para calcular el Pulse Score.");
      return;
    }

    const confirmar = await confirm({
      title: "Enviar encuesta",
      description: "¿Deseas enviar tu encuesta semanal? No podrás modificarla después.",
      confirmText: "Enviar encuesta",
    });
    if (!confirmar) return;

    const score = Math.round(
      (valoresNumericos.reduce((acc, valor) => acc + valor, 0) /
        (valoresNumericos.length * 10)) *
        100
    );

    const semaforo =
      score >= 80 ? "verde" :
      score >= 60 ? "amarillo" :
      "rojo";

    onSubmit({
      empleadoId: user.id,
      semana: semanaActual,
      respuestas,
      score,
      semaforo,
      fecha: new Date().toISOString().slice(0, 10)
    });

    setEnviada(true);
  };

  if (yaContesto || enviada) {
    return (
      <div className="admin-page empleado-page empleado-form-narrow">
        <Card className="empleado-success-card">
          <div className="empleado-success-icon">
            <Icon name="check" size={32} />
          </div>
          <h2 className="empleado-success-title">Encuesta completada</h2>
          <p className="admin-page-subtitle empleado-success-text">
            Tu encuesta fue registrada para {semanaActual}.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-page empleado-page empleado-form-narrow">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Mi encuesta</h1>
        <p className="admin-page-subtitle">
          Semana {semanaActual} · Tus respuestas son confidenciales.
        </p>
      </div>

      <Card className="empleado-progress-card">
        <div className="empleado-progress-head">
          <span>Progreso</span>
          <span>{answeredCount} de {preguntas.length} preguntas</span>
        </div>
        <div className="empleado-progress-track">
          <div className="empleado-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </Card>

      {preguntas.map((p, idx) => (
        <Card key={p.id} className="empleado-question-card">
          <div className="empleado-question-area">{p.area}</div>
          <div className="empleado-question-text">
            {idx + 1}. {p.texto}
          </div>

          {p.tipo === "escala" && (
            <div className="empleado-scale-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`empleado-scale-btn${respuestas[p.id] === num ? " empleado-scale-btn--active" : ""}`}
                  onClick={() => setR(p.id, num)}
                >
                  {num}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "sino" && (
            <div className="empleado-options-row">
              {["Sí", "No"].map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  className={`empleado-option-btn${respuestas[p.id] === opcion ? " empleado-option-btn--active" : ""}`}
                  onClick={() => setR(p.id, opcion)}
                >
                  {opcion}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "opcion" && (
            <div className="empleado-options-row empleado-options-row--wrap">
              {(p.opciones?.length ? p.opciones : DEFAULT_OPCIONES_RIESGO).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  className={`empleado-option-btn${respuestas[p.id] === opcion ? " empleado-option-btn--active" : ""}`}
                  onClick={() => setR(p.id, opcion)}
                >
                  {opcion}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "abierta" && (
            <textarea
              className="mc-form-textarea"
              placeholder="Escribe tu comentario..."
              value={respuestas[p.id] || ""}
              onChange={(e) => setR(p.id, e.target.value)}
              rows={4}
            />
          )}
        </Card>
      ))}

      <button
        type="button"
        disabled={!allAnswered}
        className="mc-btn-primary mc-btn-with-icon empleado-submit-btn"
        onClick={handleSubmit}
      >
        <Icon name="clipboardCheck" size={16} /> Enviar encuesta semanal
      </button>
    </div>
  );
};

export default EncuestaEmpleado;
