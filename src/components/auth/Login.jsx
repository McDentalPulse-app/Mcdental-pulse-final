import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { LOGO_MED } from "../../App";

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
        laura: "psico123", 
        patricia: "rh123", 
        ana: "emp123" 
      };
      await login(user, demoPasswords[user]);
    } catch (error) {
      setErr("Error en demo: " + error.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#004D40 0%,#006D5B 50%,#00897B 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ width: 420, padding: 40, background: "#fff", borderRadius: 24, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={LOGO_MED} alt="McDental Pulse" style={{ width: "100%", maxWidth: 340, height: "auto", marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>"Medimos bienestar para cuidar mejor a nuestro equipo."</div>
          <div style={{ marginTop: 8, background: "linear-gradient(135deg,#004D40,#0891b2)", color: "#fff", display: "inline-block", padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>✨ AI Engine Activado</div>
        </div>
        <input placeholder="Usuario" value={u} onChange={e => setU(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, marginBottom: 12, boxSizing: "border-box", outline: "none" }} />
        <input type="password" placeholder="Contraseña" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, marginBottom: 4, boxSizing: "border-box", outline: "none" }} />
        {err && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <button onClick={handle} disabled={loadingAuth} style={{ width: "100%", padding: "13px", background: loadingAuth ? "#9ca3af" : "#006D5B", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loadingAuth ? "not-allowed" : "pointer", marginTop: 8 }}>
          {loadingAuth ? "Iniciando..." : "Iniciar sesión"}
        </button>
        <div style={{ marginTop: 24, borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginBottom: 10 }}>ACCESO RÁPIDO DEMO</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "Admin", u: "mario" },{ label: "Psicóloga", u: "laura" },{ label: "RH", u: "patricia" },{ label: "Empleado", u: "ana" }].map(d => (
              <button key={d.u} onClick={() => demo(d.u)} disabled={loadingAuth} style={{ flex: 1, padding: "8px 4px", background: "#f0fdf4", color: "#006D5B", border: "1.5px solid #bbf7d0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: loadingAuth ? "not-allowed" : "pointer" }}>{d.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
