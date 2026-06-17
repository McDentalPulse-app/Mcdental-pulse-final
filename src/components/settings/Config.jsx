import React, { useState } from 'react';
import Card from '../common/Card';
import { UI, semaforoBg, semaforoColor } from '../../config/theme';
import Badge from '../common/Badge';
import { SUCURSALES } from '../../utils/constants';

const Config = ({ inicializarUsuariosPassword }) => {
  const [verde, setVerde] = useState(70);
  const [amarillo, setAmarillo] = useState(45);
  const [rojo, setRojo] = useState(45);

  const guardarConfig = () => {
    alert("Configuración guardada correctamente en modo demo. Cuando conectemos Firebase, estos valores se guardarán por organización.");
  };

  const roles = [
    { nombre: "Admin", acceso: "Acceso total al sistema, reportes y configuración." },
    { nombre: "Psicóloga", acceso: "Acceso a bienestar, seguimiento, reportes confidenciales y mensajes privados." },
    { nombre: "RH", acceso: "Acceso a vacaciones, permisos, descuentos, calendario y reportes RH." },
    { nombre: "Empleado", acceso: "Acceso a encuesta, historial, reconocimientos, reporte confidencial y mensajes con psicóloga." }
  ];

  const privacidad = [
    "Los mensajes privados solo son visibles entre empleado y psicóloga.",
    "RH no puede ver reportes confidenciales ni conversaciones privadas.",
    "Admin puede ver indicadores generales, pero no debe acceder al contenido de mensajes privados.",
    "Los reportes confidenciales son visibles únicamente para psicóloga y admin principal.",
    "Los datos sensibles deberán protegerse con reglas de seguridad en Firebase."
  ];

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40", textAlign: "center" }}>
        Configuración
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b", textAlign: "center" }}>
        Parámetros generales de McDental Pulse, roles, privacidad y umbrales de bienestar.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
        marginBottom: 18
      }}>
        <Card>
          <div style={{ fontSize: 26 }}>🫀</div>
          <h3 style={{ margin: "8px 0 6px", color: "#004D40" }}>McDental Pulse</h3>
          <p style={{ color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            Plataforma interna de telemetría avanzada para bienestar, clima laboral,
            seguimiento psicológico y gestión administrativa.
          </p>
        </Card>

        <Card>
          <div style={{ fontSize: 26 }}>🏢</div>
          <h3 style={{ margin: "8px 0 6px", color: "#004D40" }}>Sucursales activas</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
            {SUCURSALES.map(s => (
              <span
                key={s}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#ecfeff",
                  color: "#00796B",
                  fontWeight: 900,
                  fontSize: 13
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 26 }}>🤖</div>
          <h3 style={{ margin: "8px 0 6px", color: "#004D40" }}>AI Engine</h3>
          <p style={{ color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            Motor local por reglas activo. No genera costos de API. Preparado para conectar Gemini,
            Groq u OpenRouter más adelante.
          </p>
        </Card>
      </div>

      <Card style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, color: "#004D40" }}>
          🚦 Umbrales del semáforo
        </h3>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 18
        }}>
          <div>
            <label style={{ display: "block", fontWeight: 900, color: "#16a34a", marginBottom: 8 }}>
              🟢 Verde mayor o igual a
            </label>
            <input
              value={verde}
              onChange={(e) => setVerde(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #86efac",
                background: "#f0fdf4"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 900, color: "#d97706", marginBottom: 8 }}>
              🟡 Amarillo mayor o igual a
            </label>
            <input
              value={amarillo}
              onChange={(e) => setAmarillo(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #fbbf24",
                background: "#fffbeb"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 900, color: "#dc2626", marginBottom: 8 }}>
              🔴 Rojo menor a
            </label>
            <input
              value={rojo}
              onChange={(e) => setRojo(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #fca5a5",
                background: "#fef2f2"
              }}
            />
          </div>
        </div>

        <button
          onClick={guardarConfig}
          style={{
            border: "none",
            background: "#00897B",
            color: "white",
            padding: "12px 26px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          Guardar configuración
        </button>
      </Card>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16
      }}>
        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>
            👥 Roles del sistema
          </h3>

          <div style={{ display: "grid", gap: 10 }}>
            {roles.map(r => (
              <div
                key={r.nombre}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb"
                }}
              >
                <div style={{ fontWeight: 900, color: "#0f172a" }}>
                  {r.nombre}
                </div>
                <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                  {r.acceso}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>
            🔐 Privacidad y seguridad
          </h3>

          <div style={{ display: "grid", gap: 10 }}>
            {privacidad.map((p, idx) => (
              <div
                key={idx}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  color: "#334155",
                  lineHeight: 1.5
                }}
              >
                ✅ {p}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Config;
