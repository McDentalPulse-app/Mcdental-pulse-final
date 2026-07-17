import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, Fingerprint, Clock, ShieldCheck, HeartPulse, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './LandingPage.css';

export default function LandingPage() {
  const { user, login, logout, loadingAuth, requiereCambioPassword, cambiarPasswordActual } = useAuth();
  const [time, setTime] = useState(new Date());

  // Flip card landing ↔ login
  const [flipped, setFlipped] = useState(false);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [verPass, setVerPass] = useState(false);
  const userRef = useRef(null);

  // Panel de cambio de contraseña: desliza sobre el flip card cuando hace falta.
  const [mostrarCambioPassword, setMostrarCambioPassword] = useState(requiereCambioPassword);
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmarPass, setConfirmarPass] = useState('');
  const [errCambio, setErrCambio] = useState('');

  useEffect(() => {
    if (requiereCambioPassword) setMostrarCambioPassword(true);
  }, [requiereCambioPassword]);

  const handleLogin = async () => {
    setErr('');
    try {
      await login(u, p); // éxito → AuthContext set user/requiereCambioPassword → panel desliza o App salta al dashboard
    } catch (error) {
      setErr(error.message);
    }
  };

  const guardarNuevaPassword = async () => {
    setErrCambio('');
    if (!nuevaPass.trim() || !confirmarPass.trim()) {
      setErrCambio('Escribe y confirma tu nueva contraseña.');
      return;
    }
    if (nuevaPass.length < 6) {
      setErrCambio('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nuevaPass !== confirmarPass) {
      setErrCambio('Las contraseñas no coinciden.');
      return;
    }
    const ok = await cambiarPasswordActual(nuevaPass);
    if (ok) {
      setNuevaPass('');
      setConfirmarPass('');
    }
  };

  const volverAlLoginDesdeCambio = () => {
    setMostrarCambioPassword(false);
    setNuevaPass('');
    setConfirmarPass('');
    setErrCambio('');
    logout();
  };

  // Al voltear hacia el login: la tarjeta completa a la vista (en teléfonos
  // chicos el hero la empuja bajo el fold) y foco en el input usuario.
  // preventScroll evita que el focus dispare su propio scroll a mitad de camino.
  useEffect(() => {
    if (!flipped) return;
    userRef.current?.closest(".gw-stage")?.scrollIntoView({ behavior: "smooth", block: "start" });
    userRef.current?.focus({ preventScroll: true });
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

        {/* DERECHA: escenario con la tarjeta flip (portal ↔ login) + panel deslizante (cambiar contraseña) */}
        <div className="gw-right">
          <div className="gw-stage">
            <div className={`gw-card-flip${mostrarCambioPassword ? ' is-behind' : ''}`} inert={mostrarCambioPassword || undefined}>
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
                      <div className="auth-input-wrap">
                        <input
                          id="gw-pass"
                          type={verPass ? 'text' : 'password'}
                          className="auth-input auth-input--con-ojo"
                          placeholder="Tu contraseña"
                          value={p}
                          onChange={e => setP(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        />
                        <button
                          type="button"
                          className="auth-ojo"
                          onClick={() => setVerPass(v => !v)}
                          aria-label={verPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {verPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
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

            {/* PANEL: cambio de contraseña forzado — desliza de derecha a izquierda sobre el flip card */}
            <div
              className={`gw-card gw-changepass-panel${mostrarCambioPassword ? ' is-visible' : ''}`}
              inert={!mostrarCambioPassword || undefined}
            >
              <div className="gw-card-body gw-login-body">
                <div className="gw-auth-icon">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="gw-card-title">Cambia tu contraseña</h2>
                <p className="gw-card-text">
                  Hola {user?.name}. Por seguridad, crea una nueva contraseña para continuar.
                </p>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="gw-new-pass">Nueva contraseña</label>
                  <input
                    id="gw-new-pass"
                    type="password"
                    className="auth-input"
                    placeholder="Mínimo 6 caracteres"
                    value={nuevaPass}
                    onChange={e => setNuevaPass(e.target.value)}
                  />
                </div>

                <div className="auth-field">
                  <label className="auth-label" htmlFor="gw-confirm-pass">Confirmar contraseña</label>
                  <input
                    id="gw-confirm-pass"
                    type="password"
                    className="auth-input"
                    placeholder="Repite tu contraseña"
                    value={confirmarPass}
                    onChange={e => setConfirmarPass(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarNuevaPassword()}
                  />
                </div>

                {errCambio && <div className="auth-error">{errCambio}</div>}

                <button className="auth-btn" onClick={guardarNuevaPassword}>
                  Guardar nueva contraseña
                </button>

                <button type="button" className="gw-flip-back" onClick={volverAlLoginDesdeCambio}>
                  <ArrowLeft size={15} />
                  Volver al login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
