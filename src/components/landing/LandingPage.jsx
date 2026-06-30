import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Fingerprint, Activity, Clock, ShieldCheck, HeartPulse } from 'lucide-react';
import logoMed from '../../assets/logos/logo-med.png';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const formattedDate = time.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="gw-wrapper">
      {/* Fondo: malla de gradiente + grid + halos */}
      <div className="gw-grid-bg" aria-hidden="true" />
      <div className="gw-orb gw-orb--1" aria-hidden="true" />
      <div className="gw-orb gw-orb--2" aria-hidden="true" />

      {/* Línea de pulso decorativa */}
      <svg className="gw-pulse-svg" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="gw-pulse-line"
          d="M0,100 L260,100 L300,100 L330,40 L360,160 L390,100 L430,100 L470,70 L500,130 L530,100 L1200,100"
          fill="none"
          strokeWidth="3"
        />
      </svg>

      <div className="gw-container">
        {/* IZQUIERDA: branding */}
        <div className="gw-left">
          <div className="gw-badge">
            <span className="gw-badge-dot" />
            <Activity size={13} />
            <span>SISTEMA EN LÍNEA · v2.1</span>
          </div>

          <img src={logoMed} alt="McDental Pulse" className="gw-logo" />

          <h1 className="gw-title">
            <span className="gw-title-line">McDental</span>
            <span className="gw-title-line gw-title-accent">Pulse.</span>
          </h1>

          <p className="gw-subtext">
            Plataforma operativa de bienestar organizacional, exclusiva para el
            personal de McDental. Tus turnos, encuestas, expediente y nómina en
            un solo lugar.
          </p>

          <div className="gw-features">
            <div className="gw-feature">
              <ShieldCheck size={16} />
              <span>Acceso seguro y confidencial</span>
            </div>
            <div className="gw-feature">
              <HeartPulse size={16} />
              <span>Seguimiento de tu bienestar</span>
            </div>
          </div>
        </div>

        {/* DERECHA: tarjeta glass de acceso */}
        <div className="gw-right">
          <div className="gw-card">
            <div className="gw-card-header">
              <div className="gw-clock">
                <Clock size={18} />
                <div>
                  <div className="gw-clock-time">{formattedTime}</div>
                  <div className="gw-clock-date">{formattedDate}</div>
                </div>
              </div>
            </div>

            <div className="gw-card-body">
              <div className="gw-auth-icon">
                <Fingerprint size={30} />
              </div>
              <h2 className="gw-card-title">Autenticación requerida</h2>
              <p className="gw-card-text">
                Verifica tu identidad para acceder a tu área de trabajo.
              </p>

              <button className="gw-btn" onClick={() => navigate('/login')}>
                <span>Iniciar sesión</span>
                <div className="gw-btn-icon">
                  <ArrowRight size={18} />
                </div>
              </button>
            </div>

            <div className="gw-card-footer">
              <span>McDental Pulse · Uso interno autorizado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
