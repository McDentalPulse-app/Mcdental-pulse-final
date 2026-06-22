import React, { useState } from 'react';
import Card from '../common/Card';
import SectionTitle from '../common/SectionTitle';
import StatCard from '../common/StatCard';
import Icon from '../ui/Icon';
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
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Configuración</h1>
        <p className="admin-page-subtitle">
          Parámetros generales de McDental Pulse, roles, privacidad y umbrales de bienestar.
        </p>
      </div>

      <div className="admin-grid-auto">
        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap">
            <Icon name="activity" size={20} />
          </div>
          <h3 className="admin-section-title" style={{ marginBottom: 8 }}>McDental Pulse</h3>
          <p className="admin-list-item-meta" style={{ margin: 0 }}>
            Plataforma interna de telemetría avanzada para bienestar, clima laboral,
            seguimiento psicológico y gestión administrativa.
          </p>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap">
            <Icon name="building" size={20} />
          </div>
          <SectionTitle icon="building" className="config-inline-title">Sucursales activas</SectionTitle>
          <div className="mc-tag-grid">
            {SUCURSALES.map(s => (
              <span key={s} className="mc-tag">{s}</span>
            ))}
          </div>
        </Card>

        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap">
            <Icon name="ai" size={20} />
          </div>
          <SectionTitle icon="ai" className="config-inline-title">AI Engine</SectionTitle>
          <p className="admin-list-item-meta" style={{ margin: 0 }}>
            Motor local por reglas activo. No genera costos de API. Preparado para conectar Gemini,
            Groq u OpenRouter más adelante.
          </p>
        </Card>
      </div>

      <Card>
        <SectionTitle icon="stable">Umbrales del semáforo</SectionTitle>

        <div className="admin-grid-auto">
          <div className="mc-form-group config-threshold--verde">
            <label className="mc-form-label config-threshold-label--verde">
              <Icon name="check" size={14} /> Verde mayor o igual a
            </label>
            <input className="mc-form-input" value={verde} onChange={(e) => setVerde(e.target.value)} />
          </div>
          <div className="mc-form-group config-threshold--amarillo">
            <label className="mc-form-label config-threshold-label--amarillo">
              <Icon name="warning" size={14} /> Amarillo mayor o igual a
            </label>
            <input className="mc-form-input" value={amarillo} onChange={(e) => setAmarillo(e.target.value)} />
          </div>
          <div className="mc-form-group config-threshold--rojo">
            <label className="mc-form-label config-threshold-label--rojo">
              <Icon name="critical" size={14} /> Rojo menor a
            </label>
            <input className="mc-form-input" value={rojo} onChange={(e) => setRojo(e.target.value)} />
          </div>
        </div>

        <button className="mc-btn-primary" onClick={guardarConfig} style={{ marginTop: 8 }}>
          Guardar configuración
        </button>
      </Card>

      <div className="admin-grid-2">
        <Card>
          <SectionTitle icon="users">Roles del sistema</SectionTitle>
          <div className="mc-form-grid">
            {roles.map(r => (
              <div key={r.nombre} className="config-role-item">
                <div className="config-role-name">{r.nombre}</div>
                <div className="config-role-desc">{r.acceso}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon="shield">Privacidad y seguridad</SectionTitle>
          <div className="mc-form-grid">
            {privacidad.map((p, idx) => (
              <div key={idx} className="config-privacy-item">
                <Icon name="check" size={14} className="config-privacy-check" /> {p}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Config;
