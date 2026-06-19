import React, { useState } from "react";
import Card from "../common/Card";
import { ENCUESTA_PREGUNTAS } from "../../data/initialData";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";
import { USERS } from "../../data/initialData";
import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";

const EncuestaEmpleado = ({ user, encuestas = [], onSubmit }) => {
  const yaContesto = encuestas.some(
    (e) => e.empleadoId === user.id && e.semana === semanaActual
  );

  const [respuestas, setRespuestas] = useState({});
  const [enviada, setEnviada] = useState(false);

  const preguntas = ENCUESTA_PREGUNTAS;

  const setR = (id, val) => {
    setRespuestas((prev) => ({
      ...prev,
      [id]: val
    }));
  };

  const allAnswered = preguntas.every(
    (p) => respuestas[p.id] !== undefined && respuestas[p.id] !== ""
  );

  const handleSubmit = () => {
    const preguntasConScore = preguntas.filter((p) => p.tipo === "escala");

const valoresNumericos = preguntasConScore
  .map((p) => Number(respuestas[p.id]))
  .filter((valor) => Number.isFinite(valor));

if (valoresNumericos.length !== preguntasConScore.length) {
  alert("Faltan respuestas numéricas para calcular el Pulse Score.");
  return;
}

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
      <Card style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>

        <h3 style={{ color: "#004D40", margin: "0 0 8px" }}>
          ¡Encuesta completada!
        </h3>

        <p style={{ color: "#6b7280", fontSize: 13 }}>
          Tu encuesta fue registrada para {semanaActual}.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#004D40" }}>
          📝 Mi Encuesta
        </h2>

        <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 13 }}>
          Semana {semanaActual} · Tus respuestas son confidenciales.
        </p>
      </div>

      {preguntas.map((p, idx) => (
        <Card key={p.id} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#006D5B", fontWeight: 800, marginBottom: 6 }}>
            {p.area}
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>
            {idx + 1}. {p.texto}
          </div>

          {p.tipo === "escala" && (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {[1,2,3,4,5,6,7,8,9,10].map((num) => (
      <button
        key={num}
        type="button"
        onClick={() => setR(p.id, num)}
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          border: respuestas[p.id] === num ? "2px solid #006D5B" : "1px solid #d1d5db",
          background: respuestas[p.id] === num ? "#E6FFFA" : "#ffffff",
          color: "#004D40",
          fontWeight: 800,
          cursor: "pointer"
        }}
      >
        {num}
      </button>
    ))}
  </div>
)}

{p.tipo === "sino" && (
  <div style={{ display: "flex", gap: 8 }}>
    {["Sí", "No"].map((opcion) => (
      <button
        key={opcion}
        type="button"
        onClick={() => setR(p.id, opcion)}
        style={{
          padding: "10px 18px",
          borderRadius: 10,
          border: respuestas[p.id] === opcion ? "2px solid #006D5B" : "1px solid #d1d5db",
          background: respuestas[p.id] === opcion ? "#E6FFFA" : "#ffffff",
          color: "#004D40",
          fontWeight: 800,
          cursor: "pointer"
        }}
      >
        {opcion}
      </button>
    ))}
  </div>
)}

{p.tipo === "opcion" && (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {p.opciones.map((opcion) => (
      <button
        key={opcion}
        type="button"
        onClick={() => setR(p.id, opcion)}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: respuestas[p.id] === opcion ? "2px solid #006D5B" : "1px solid #d1d5db",
          background: respuestas[p.id] === opcion ? "#E6FFFA" : "#ffffff",
          color: "#004D40",
          fontWeight: 800,
          cursor: "pointer"
        }}
      >
        {opcion}
      </button>
    ))}
  </div>
)}

{p.tipo === "abierta" && (
  <textarea
    placeholder="Escribe tu comentario..."
    value={respuestas[p.id] || ""}
    onChange={(e) => setR(p.id, e.target.value)}
    style={{
      width: "100%",
      minHeight: 90,
      padding: 12,
      borderRadius: 10,
      border: "1px solid #d1d5db",
      resize: "vertical"
    }}
  />
)}
        </Card>
      ))}

      <button
        type="button"
        disabled={!allAnswered}
        onClick={handleSubmit}
        style={{
          width: "100%",
          marginTop: 8,
          border: "none",
          borderRadius: 12,
          padding: "14px 18px",
          background: allAnswered ? "#006D5B" : "#9ca3af",
          color: "white",
          fontWeight: 800,
          cursor: allAnswered ? "pointer" : "not-allowed"
        }}
      >
        Enviar encuesta semanal
      </button>
    </div>
  );
};


export default EncuestaEmpleado;
