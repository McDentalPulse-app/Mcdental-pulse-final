import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import logoSmall from "../../assets/logos/logo-small.png";
import Avatar from "../ui/Avatar";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.split("/").pop() || "dashboard";

  const navItems = {
    admin: [
      { key: "dashboard", icon: "📊", label: "Dashboard" },
      { key: "ai", icon: "🤖", label: "AI Engine", badge: "NEW" },
      { key: "empleados", icon: "👥", label: "Empleados" },
      { key: "usuarios", icon: "⚙️", label: "Gestión de Personal" },
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
      { key: "usuarios", icon: "⚙️", label: "Gestión de Personal" },
      { key: "empleados", icon: "👥", label: "Empleados" },
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
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo-wrap">
          <img src={logoSmall} alt="McDental Pulse" className="sidebar-logo" />
        </div>
        <div className="sidebar-ai-badge">✨ AI Engine Activo</div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(`/${user.role}/${item.key}`)}
              className={`sidebar-nav-btn${isActive ? " sidebar-nav-btn--active" : ""}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <Avatar name={user?.name || ""} size={36} color="#00A88F" />
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">{user?.name?.split(" ")[0] || ""}</div>
            <div className="sidebar-user-role">{user?.role || ""}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
