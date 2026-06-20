import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";

import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";

const ReporteConfidencialEmpleado = ({ user, onSubmit }) => {
  const { usuarios: USERS } = useGlobal();

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

  const enviar = () => {
    if (!descripcion.trim()) {
      alert("Por favor escribe una descripción del reporte.");
      return;
    }

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
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Reporte Confidencial
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Este espacio permite reportar situaciones sensibles. La información será visible únicamente para Psicóloga y Admin Principal.
      </p>

      {enviado ? (
        <Card>
          <h3 style={{ color: "#004D40", marginTop: 0 }}>✅ Reporte enviado</h3>
          <p style={{ color: "#334155" }}>
            Tu reporte fue registrado de forma confidencial para seguimiento.
          </p>
          <button
            onClick={() => setEnviado(false)}
            style={{
              border: "none",
              background: "#00897B",
              color: "white",
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Crear otro reporte
          </button>
        </Card>
      ) : (
        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>🔒 Nuevo reporte</h3>

          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ fontWeight: 800, color: "#0f172a" }}>
              Tipo de reporte
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1"
                }}
              >
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label style={{ fontWeight: 800, color: "#0f172a" }}>
              Nivel de urgencia
              <select
                value={urgencia}
                onChange={(e) => setUrgencia(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1"
                }}
              >
                <option>Baja</option>
                <option>Media</option>
                <option>Alta</option>
                <option>Crítica</option>
              </select>
            </label>

            <label style={{ fontWeight: 800, color: "#0f172a" }}>
              Descripción
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe lo ocurrido con el mayor detalle posible..."
                rows={5}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  resize: "vertical"
                }}
              />
            </label>

            <label style={{ fontWeight: 800, color: "#0f172a" }}>
              Evidencias o notas adicionales
              <textarea
                value={evidencias}
                onChange={(e) => setEvidencias(e.target.value)}
                placeholder="Puedes indicar si tienes evidencias, fechas, personas involucradas o contexto adicional..."
                rows={3}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  resize: "vertical"
                }}
              />
            </label>

            <button
              onClick={enviar}
              style={{
                border: "none",
                background: "#004D40",
                color: "white",
                padding: "12px 16px",
                borderRadius: 10,
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              Enviar reporte confidencial
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};


export default ReporteConfidencialEmpleado;
