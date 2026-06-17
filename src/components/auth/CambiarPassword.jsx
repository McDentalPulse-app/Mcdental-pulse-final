import React, { useState } from 'react';
import { UI } from '../../config/theme';
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
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#004D40 0%,#006D5B 50%,#00897B 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24
    }}>
      <div style={{
        width: 420,
        background: "white",
        borderRadius: 24,
        padding: 32,
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
        textAlign: "center"
      }}>
        <img src={logoSmall} alt="McDental Pulse" style={{ width: "100%", maxWidth: 300, marginBottom: 16 }} />

        <h2 style={{ color: "#004D40", marginBottom: 8 }}>
          Cambia tu contraseña
        </h2>

        <p style={{ color: "#64748b", marginBottom: 20 }}>
          Hola {user?.name}. Por seguridad, crea una nueva contraseña para continuar.
        </p>

        <input
          type="password"
          placeholder="Nueva contraseña"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1.5px solid #cbd5e1", marginBottom: 12 }}
        />

        <input
          type="password"
          placeholder="Confirmar contraseña"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && guardar()}
          style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1.5px solid #cbd5e1", marginBottom: 12 }}
        />

        {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{err}</div>}

        <button
          onClick={guardar}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 10,
            border: "none",
            background: "#006D5B",
            color: "white",
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          Guardar nueva contraseña
        </button>
      </div>
    </div>
  );
};

export default CambiarPassword;
