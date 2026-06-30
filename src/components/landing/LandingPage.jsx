import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, Fingerprint, Activity, Clock, ShieldCheck, HeartPulse } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logoMed from '../../assets/logos/logo-med.png';
import './LandingPage.css';

export default function LandingPage() {
  const { login, loadingAuth } = useAuth();
  const [time, setTime] = useState(new Date());

  // Flip card landing ↔ login
  const [flipped, setFlipped] = useState(false);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const userRef = useRef(null);

  const handleLogin = async () => {
    setErr('');
    try {
      await login(u, p); // éxito → AuthContext set user → App salta al dashboard
    } catch (error) {
      setErr(error.message);
    }
  };

  // Al voltear hacia el login, foco en el input usuario
  useEffect(() => {
    if (flipped) userRef.current?.focus();
  }, [flipped]);

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
            <span>Bienvenido</span>
          </div>

          <img src={logoMed} alt="McDental Pulse" className="gw-logo" />

          <h1 className="gw-title">
            <span className="gw-title-line">McDental</span>
            <span className="gw-title-line gw-title-accent">Pulse.</span>
          </h1>

          <p className="gw-subtext">
            Plataforma operativa de bienestar organizacional, exclusiva para el
            personal de DEMARU.
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

        {/* DERECHA: tarjeta glass de acceso (flip: portal ↔ login) */}
        <div className="gw-right">
          <div className="gw-card-flip">
            <div className={`gw-card-inner${flipped ? ' is-flipped' : ''}`}>

              {/* CARA FRONTAL: portal */}
              <div className="gw-card gw-card-face gw-card-face--front" inert={flipped || undefined}>
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

                  <button className="gw-btn" onClick={() => setFlipped(true)}>
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

              {/* CARA TRASERA: login */}
              <div className="gw-card gw-card-face gw-card-face--back" inert={!flipped || undefined}>
                <div className="gw-card-body gw-login-body">
                  <div className="gw-auth-icon">
                    <ShieldCheck size={28} />
                  </div>
                  <h2 className="gw-card-title">Iniciar sesión</h2>
                  <p className="gw-card-text">Ingresa tus credenciales McDental.</p>

                  <div className="auth-field">
                    <label className="auth-label" htmlFor="gw-user">Usuario</label>
                    <input
                      id="gw-user"
                      ref={userRef}
                      className="auth-input"
                      placeholder="Tu usuario"
                      value={u}
                      onChange={e => setU(e.target.value)}
                    />
                  </div>

                  <div className="auth-field">
                    <label className="auth-label" htmlFor="gw-pass">Contraseña</label>
                    <input
                      id="gw-pass"
                      type="password"
                      className="auth-input"
                      placeholder="Tu contraseña"
                      value={p}
                      onChange={e => setP(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    />
                  </div>

                  {err && <div className="auth-error">{err}</div>}

                  <button className="auth-btn" onClick={handleLogin} disabled={loadingAuth}>
                    {loadingAuth ? 'Iniciando...' : 'Iniciar sesión'}
                  </button>

                  <button type="button" className="gw-flip-back" onClick={() => setFlipped(false)}>
                    <ArrowLeft size={15} />
                    Volver al portal
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
