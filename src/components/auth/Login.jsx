import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Icon from "../ui/Icon";
import logoMed from "../../assets/logos/logo-med.png";

const Login = () => {
  const { login, loadingAuth } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const handle = async () => {
    setErr("");
    try {
      await login(u, p);
    } catch (error) {
      setErr(error.message);
    }
  };

  const demo = async (user) => {
    setErr("");
    try {
      const demoPasswords = {
        mario: "admin123",
        "ana salas": "psico123",
        patricia: "rh123",
        ana: "emp123"
      };
      await login(user, demoPasswords[user]);
    } catch (error) {
      setErr("Error en demo: " + error.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logoMed} alt="McDental Pulse" className="auth-logo" />
          <p className="auth-microcopy">
            Plataforma de bienestar organizacional para clínicas dentales
          </p>
          <span className="auth-badge">
            <Icon name="shield" size={13} />
            Acceso interno McDental
          </span>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-user">Usuario</label>
          <input
            id="login-user"
            className="auth-input"
            placeholder="Tu usuario"
            value={u}
            onChange={e => setU(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-pass">Contraseña</label>
          <input
            id="login-pass"
            type="password"
            className="auth-input"
            placeholder="Tu contraseña"
            value={p}
            onChange={e => setP(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
          />
        </div>

        {err && <div className="auth-error">{err}</div>}

        <button className="auth-btn" onClick={handle} disabled={loadingAuth}>
          {loadingAuth ? "Iniciando..." : "Iniciar sesión"}
        </button>

        <div className="auth-demo">
          <div className="auth-demo-label">Acceso demo</div>
          <div className="auth-demo-grid">
            {[
              { label: "Admin", u: "mario" },
              { label: "Psicóloga", u: "ana salas" },
              { label: "RH", u: "patricia" },
              { label: "Empleado", u: "ana" },
            ].map(d => (
              <button
                key={d.u}
                className="auth-demo-btn"
                onClick={() => demo(d.u)}
                disabled={loadingAuth}
                type="button"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
