import React, { useState } from 'react';
import logoSmall from '../../assets/logos/logo-small.png';

const CambiarPassword = ({ user, onCambiarPassword }) => {
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [err, setErr] = useState("");

  const guardar = () => {
    if (!nueva.trim() || !confirmar.trim()) {
      setErr("Escribe y confirma tu nueva contraseña.");
      return;
    }

    if (nueva.length < 6) {
      setErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (nueva !== confirmar) {
      setErr("Las contraseñas no coinciden.");
      return;
    }

    onCambiarPassword(nueva);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logoSmall} alt="McDental Pulse" className="auth-logo" style={{ maxWidth: 220 }} />
          <h2 className="auth-title">Cambia tu contraseña</h2>
          <p className="auth-subtitle">
            Hola {user?.name}. Por seguridad, crea una nueva contraseña para continuar.
          </p>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="new-pass">Nueva contraseña</label>
          <input
            id="new-pass"
            type="password"
            className="auth-input"
            placeholder="Mínimo 6 caracteres"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="confirm-pass">Confirmar contraseña</label>
          <input
            id="confirm-pass"
            type="password"
            className="auth-input"
            placeholder="Repite tu contraseña"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
          />
        </div>

        {err && <div className="auth-error">{err}</div>}

        <button className="auth-btn" onClick={guardar}>
          Guardar nueva contraseña
        </button>
      </div>
    </div>
  );
};

export default CambiarPassword;
