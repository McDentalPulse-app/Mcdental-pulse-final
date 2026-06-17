import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import logoSmall from "../../assets/logos/logo-small.png";
import Avatar from "../ui/Avatar";

const Sidebar = ({ active, setActive }) => {
  const { user, logout } = useAuth();

  const navItems = {
    admin: [
      { key: "dashboard", icon: "📊", label: "Dashboard" },
      { key: "ai", icon: "🤖", label: "AI Engine", badge: "NEW" },
      { key: "empleados", icon: "👥", label: "Empleados" },
      { key: "expedientes", icon: "📁", label: "Expedientes" },
      { key: "reconocimientos", icon: "🏅", label: "Reconocimientos" },
      { key: "eventospersonal", icon: "🎂", label: "Cumpleaños y Aniversarios" },
      { key: "encuestas", icon: "📋", label: "Encuestas" },
      { key: "reportes", icon: "📈", label: "Reportes" },
      { key: "confidenciales", icon: "🔒", label: "Reportes Confidenciales" },
      { key: "config", icon: "⚙️", label: "Config" },
    ],
    psicologa: [
      { key: "dashboard", icon: "📊", label: "Dashboard" },
      { key: "ai", icon: "🤖", label: "AI Engine", badge: "NEW" },
      { key: "seguimiento", icon: "🎯", label: "Seguimiento" },
      { key: "confidenciales", icon: "🔒", label: "Reportes Confidenciales" },
      { key: "empleados", icon: "👥", label: "Empleados" },
      { key: "expedientes", icon: "📁", label: "Expedientes" },
      { key: "mensajes", icon: "💬", label: "Mensajes" },
    ],
    rh: [
      { key: "dashboard", icon: "📊", label: "Dashboard RH" },
      { key: "vacaciones", icon: "🏖️", label: "Vacaciones" },
      { key: "descuentos", icon: "💸", label: "Descuentos" },
      { key: "calendario", icon: "📅", label: "Calendario" },
      { key: "eventospersonal", icon: "🎂", label: "Cumpleaños y Aniversarios" },
      { key: "reconocimientos", icon: "🏅", label: "Reconocimientos" },
      { key: "reportesrh", icon: "📈", label: "Reportes RH" },
    ],
    empleado: [
      { key: "inicio", icon: "🏠", label: "Inicio" },
      { key: "encuesta", icon: "📝", label: "Mi Encuesta" },
      { key: "historial", icon: "▦", label: "Historial" },
      { key: "permisosempleado", icon: "🏖️", label: "Vacaciones" },
      { key: "reconocimientos", icon: "🏅", label: "Reconocimientos" },
      { key: "reporteconfidencial", icon: "🔒", label: "Reporte Confidencial" },
      { key: "mensajes", icon: "💬", label: "Mensajes" },
    ],
  };
  
  const items = navItems[user?.role] || [];
  
  return (
  <aside
    style={{
      width: 248,
      background: "linear-gradient(180deg, #003F35 0%, #005647 52%, #00382F 100%)",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      flexShrink: 0,
      boxShadow: "14px 0 35px rgba(15, 23, 42, 0.14)",
      position: "sticky",
      top: 0
    }}
  >
    <div
      style={{
        padding: "22px 22px 18px",
        borderBottom: "1px solid rgba(255,255,255,.12)"
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,.08)",
          borderRadius: 18,
          padding: 10,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)"
        }}
      >
        <img
          src={logoSmall}
          alt="McDental Pulse"
          style={{
            width: "100%",
            maxWidth: 180,
            display: "block",
            margin: "0 auto"
          }}
        />
      </div>

      <div
        style={{
          marginTop: 12,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(0,168,143,.18)",
          color: "#CFFDF5",
          fontSize: 10,
          letterSpacing: 1.8,
          textTransform: "uppercase",
          fontWeight: 900
        }}
      >
        ✨ AI Engine Activo
      </div>
    </div>

    <nav style={{ padding: "18px 14px", flex: 1 }}>
      {items.map((item) => {
        const isActive = active === item.key;

        return (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            style={{
              width: "100%",
              padding: "12px 13px",
              borderRadius: 14,
              border: isActive ? "1px solid rgba(255,255,255,.9)" : "1px solid transparent",
              background: isActive
                ? "linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.12))"
                : "transparent",
              color: "#fff",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 11,
              marginBottom: 7,
              cursor: "pointer",
              fontWeight: isActive ? 900 : 700,
              fontSize: 13,
              boxShadow: isActive ? "0 10px 25px rgba(0,0,0,.16)" : "none"
            }}
          >
            <span
              style={{
                width: 25,
                height: 25,
                borderRadius: 9,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)"
              }}
            >
              {item.icon}
            </span>

            <span style={{ flex: 1 }}>{item.label}</span>

            {item.badge && (
              <span
                style={{
                  background: "linear-gradient(135deg,#ff6b6b,#ee3f7f)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 900,
                  padding: "3px 7px",
                  borderRadius: 999
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>

    <div
      style={{
        padding: "18px 14px",
        borderTop: "1px solid rgba(255,255,255,.12)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: 12,
          borderRadius: 16,
          background: "rgba(255,255,255,.08)",
          marginBottom: 12
        }}
      >
        <Avatar name={user?.name || ""} size={36} color="#00A88F" />

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {user?.name?.split(" ")[0] || ""}
          </div>

          <div
            style={{
              fontSize: 10,
              color: "#B7F7EE",
              textTransform: "capitalize",
              marginTop: 2
            }}
          >
            {user?.role || ""}
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        style={{
          width: "100%",
          padding: "10px 12px",
          background: "rgba(255,255,255,.12)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer"
        }}
      >
        Cerrar sesión
      </button>
    </div>
  </aside>
  );
};

export default Sidebar;