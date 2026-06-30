import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import logoSmall from "../../assets/logos/logo-small.png";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.split("/").pop() || "dashboard";

  const navItems = {
    admin: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard" },
      { key: "ai", icon: "ai", label: "AI Engine", badge: "NEW" },
      { key: "empleados", icon: "users", label: "Empleados" },
      { key: "usuarios", icon: "userCog", label: "Gestión de Personal" },
      { key: "expedientes", icon: "folder", label: "Expedientes" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos" },
      { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios" },
      { key: "encuestas", icon: "clipboard", label: "Encuestas" },
      { key: "reportes", icon: "trending", label: "Reportes" },
      { key: "confidenciales", icon: "lock", label: "Reportes Confidenciales" },
      { key: "config", icon: "settings", label: "Config" },
    ],
    psicologa: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard" },
      { key: "ai", icon: "ai", label: "AI Engine", badge: "NEW" },
      { key: "seguimiento", icon: "target", label: "Seguimiento" },
      { key: "confidenciales", icon: "lock", label: "Reportes Confidenciales" },
      { key: "empleados", icon: "users", label: "Empleados" },
      { key: "expedientes", icon: "folder", label: "Expedientes" },
      { key: "mensajes", icon: "message", label: "Mensajes" },
    ],
    rh: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard RH" },
      { key: "usuarios", icon: "userCog", label: "Gestión de Personal" },
      { key: "empleados", icon: "users", label: "Empleados" },
      { key: "vacaciones", icon: "vacation", label: "Vacaciones" },
      { key: "descuentos", icon: "dollar", label: "Descuentos" },
      { key: "calendario", icon: "calendar", label: "Calendario" },
      { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos" },
      { key: "reportesrh", icon: "trending", label: "Reportes RH" },
    ],
    empleado: [
      { key: "inicio", icon: "home", label: "Inicio" },
      { key: "encuesta", icon: "clipboardCheck", label: "Mi Encuesta" },
      { key: "historial", icon: "history", label: "Historial" },
      { key: "permisosempleado", icon: "vacation", label: "Vacaciones" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos" },
      { key: "reporteconfidencial", icon: "lock", label: "Reporte Confidencial" },
      { key: "mensajes", icon: "message", label: "Mensajes" },
    ],
  };

  const items = navItems[user?.role] || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <img src={logoSmall} alt="McDental Pulse" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">McDental Pulse</span>
            <span className="sidebar-brand-sub">Bienestar organizacional</span>
          </div>
        </div>
        <div className="sidebar-ai-badge">
          <Icon name="sparkles" size={11} />
          AI Engine
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => navigate(`/${user.role}/${item.key}`)}
              className={`sidebar-nav-btn${isActive ? " sidebar-nav-btn--active" : ""}`}
            >
              <span className="sidebar-nav-icon">
                <Icon name={item.icon} size={17} />
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <Avatar name={user?.name || ""} size={36} color="#3D8B7E" />
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">{user?.name?.split(" ")[0] || ""}</div>
            <div className="sidebar-user-role">{user?.role || ""}</div>
          </div>
        </div>
        <button type="button" className="sidebar-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
          <Icon name="logout" size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
