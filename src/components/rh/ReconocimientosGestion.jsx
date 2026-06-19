import React, { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import RiskBar from "../common/RiskBar";
import { semaforoColor, semaforoBg, semaforoLabel } from "../../config/theme";
import { USERS } from "../../data/initialData";
import { semanaActual } from "../../utils/constants";
import { calcularAntiguedad } from "../../utils/helpers";
import { calcPulseScore, getPulseStatus, calcRiesgos } from "../../utils/pulseScore";

const ReconocimientosGestion = ({ users, reconocimientos, onAdd, currentUser }) => {
  const empleados = users.filter((u) => u.role === "empleado");
const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || "");
const [categoria, setCategoria] = useState("Excelente actitud");
const [comentario, setComentario] = useState("");
const [diplomaArchivo, setDiplomaArchivo] = useState(null);

  const categorias = [
    "Excelente actitud",
    "Liderazgo",
    "Trabajo en equipo",
    "Innovación",
    "Atención al paciente",
    "Puntualidad",
    "Valores McDental"
  ];

  const otorgar = () => {
    const empleado = empleados.find(e => e.id === Number(empleadoId));
    if (!empleado) {
      alert("Selecciona un empleado.");
      return;
    }

    if (!comentario.trim()) {
      alert("Escribe un comentario para el reconocimiento.");
      return;
    }
    if (diplomaArchivo) {
  const continuar = window.confirm(
    "El diploma no se subirá todavía porque Firebase Storage no está activo.\n\n¿Deseas otorgar el reconocimiento sin diploma?"
  );

  if (!continuar) return;
}

    onAdd({
      empleadoId: empleado.id,
      empleado: empleado.name,
      sucursal: empleado.sucursal,
      puesto: empleado.puesto,
      categoria,
      otorgadoPor: currentUser.name,
      comentario
    });

    setCategoria("Excelente actitud");
setComentario("");
setDiplomaArchivo(null);
alert("Reconocimiento otorgado.");
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Reconocimientos
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Otorga y consulta reconocimientos al personal por desempeño, actitud y valores McDental.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginBottom: 22
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>🏅</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#00897B" }}>
            {reconocimientos.length}
          </div>
          <div style={{ fontWeight: 700 }}>Reconocimientos totales</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>👥</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#2563eb" }}>
            {new Set(reconocimientos.map(r => r.empleadoId)).size}
          </div>
          <div style={{ fontWeight: 700 }}>Empleados reconocidos</div>
        </Card>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16
      }}>
        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>➕ Otorgar reconocimiento</h3>

          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ fontWeight: 800, color: "#0f172a" }}>
              Empleado
              <select
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1"
                }}
              >
                {empleados.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.sucursal} · {e.puesto}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontWeight: 800, color: "#0f172a" }}>
              Categoría
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1"
                }}
              >
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label style={{ fontWeight: 800, color: "#0f172a" }}>
              Comentario
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Describe el motivo del reconocimiento..."
                rows={4}
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
              <div style={{ marginTop: 12, textAlign: "left" }}>
  <label style={{ display: "block", fontWeight: 800, color: "#004D40", marginBottom: 6 }}>
    Diploma del reconocimiento
  </label>

  <input
    type="file"
    accept=".pdf,image/*"
    onChange={(e) => setDiplomaArchivo(e.target.files?.[0] || null)}
    style={{ width: "100%" }}
  />

  {diplomaArchivo && (
    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
      Archivo seleccionado: {diplomaArchivo.name}
    </div>
  )}

  <div style={{ marginTop: 6, fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>
    Adjunto preparado. La carga del diploma se activará cuando Firebase Storage esté habilitado.
  </div>
</div>
            <button
              onClick={otorgar}
              style={{
                border: "none",
                background: "#00897B",
                color: "white",
                padding: "12px 16px",
                borderRadius: 10,
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              Otorgar reconocimiento
            </button>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>📋 Historial reciente</h3>

          <div style={{ display: "grid", gap: 12 }}>
            {reconocimientos.slice().reverse().map(r => (
              <div
                key={r.id}
                style={{
                  padding: 14,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#f8fafc"
                }}
              >
                <div style={{ fontWeight: 900, color: "#0f172a" }}>{r.empleado}</div>
                <div style={{ color: "#004D40", fontWeight: 800 }}>
                  🏅 {r.categoria}
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {r.fecha} · {r.sucursal} · Otorgado por {r.otorgadoPor}
                </div>
                <div style={{ color: "#334155", marginTop: 6 }}>
                  {r.comentario}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};


export default ReconocimientosGestion;
