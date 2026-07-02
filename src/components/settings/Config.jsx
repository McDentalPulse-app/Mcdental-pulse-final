import React, { useState } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import Card from '../common/Card';
import SectionTitle from '../common/SectionTitle';
import StatCard from '../common/StatCard';
import PageHeader from '../common/PageHeader';
import Icon from '../ui/Icon';
import { SUCURSALES } from '../../utils/constants';

const Config = () => {
  const { toast } = useNotification();
  const [verde, setVerde] = useState(70);
  const [amarillo, setAmarillo] = useState(45);
  const [rojo, setRojo] = useState(45);

  const guardarConfig = () => {
    toast.success("Configuración guardada correctamente en modo demo. Estos valores todavía no se persisten por organización.");
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
    "Los datos sensibles se protegen con Row Level Security a nivel de base de datos."
  ];

  return (
    <div className="admin-page">
      <PageHeader
        icon="settings"
        title="Configuración"
        subtitle="Parámetros generales de McDental Pulse, roles, privacidad y umbrales de bienestar."
      />

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

      <Card className="config-panel">
        <SectionTitle icon="stable">Umbrales del semáforo</SectionTitle>
        <p className="config-panel-lead">
          Rangos de Pulse Score para clasificar el bienestar del equipo en verde, amarillo y rojo.
        </p>

        <div className="config-threshold-grid">
          <div className="config-threshold-card config-threshold--verde">
            <label className="mc-form-label config-threshold-label--verde" htmlFor="cfg-verde">
              <Icon name="check" size={14} /> Verde mayor o igual a
            </label>
            <input id="cfg-verde" className="mc-form-input config-threshold-input" value={verde} onChange={(e) => setVerde(e.target.value)} />
          </div>
          <div className="config-threshold-card config-threshold--amarillo">
            <label className="mc-form-label config-threshold-label--amarillo" htmlFor="cfg-amarillo">
              <Icon name="warning" size={14} /> Amarillo mayor o igual a
            </label>
            <input id="cfg-amarillo" className="mc-form-input config-threshold-input" value={amarillo} onChange={(e) => setAmarillo(e.target.value)} />
          </div>
          <div className="config-threshold-card config-threshold--rojo">
            <label className="mc-form-label config-threshold-label--rojo" htmlFor="cfg-rojo">
              <Icon name="critical" size={14} /> Rojo menor a
            </label>
            <input id="cfg-rojo" className="mc-form-input config-threshold-input" value={rojo} onChange={(e) => setRojo(e.target.value)} />
          </div>
        </div>

        <div className="config-panel-footer">
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={guardarConfig}>
            <Icon name="check" size={16} /> Guardar configuración
          </button>
        </div>
      </Card>

      <div className="admin-grid-2 config-info-grid">
        <Card className="config-info-card">
          <SectionTitle icon="users">Roles del sistema</SectionTitle>
          <div className="config-info-list">
            {roles.map(r => (
              <div key={r.nombre} className="config-role-item">
                <div className="config-role-name">{r.nombre}</div>
                <div className="config-role-desc">{r.acceso}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="config-info-card">
          <SectionTitle icon="shield">Privacidad y seguridad</SectionTitle>
          <div className="config-info-list">
            {privacidad.map((p, idx) => (
              <div key={idx} className="config-privacy-item">
                <Icon name="check" size={14} className="config-privacy-check" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Config;
