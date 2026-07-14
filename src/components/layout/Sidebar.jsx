import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useNavigate, useLocation } from "react-router-dom";
import { notify } from "../../utils/notify";
import logoSmall from "../../assets/logos/logo-small.png";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import "./Sidebar.css";

const RAIL_KEY = "mcdental_sidebar_rail";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.split("/").pop() || "dashboard";

  const reduce = useReducedMotion();
  const pillTransition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 380, damping: 32 };

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(RAIL_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  const navItems = {
    admin: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard" },
      { key: "ai", icon: "ai", label: "AI Engine" },
      { key: "empleados", icon: "users", label: "Empleados" },
      { key: "usuarios", icon: "userCog", label: "Gestión de Personal" },
      { key: "asistencia", icon: "clock", label: "Asistencia" },
      { key: "sucursales", icon: "mapPin", label: "Sucursales" },
      { key: "horarios", icon: "calendarDays", label: "Horarios" },
      { key: "importar-horarios", icon: "file", label: "Importar horarios" },
      { key: "rostros", icon: "camera", label: "Rostros" },
      { key: "expedientes", icon: "folder", label: "Expedientes" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos" },
      { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios" },
      { key: "encuestas", icon: "clipboard", label: "Encuestas" },
      { key: "reportes", icon: "trending", label: "Reportes" },
      { key: "confidenciales", icon: "lock", label: "Reportes Confidenciales" },
      { key: "config", icon: "settings", label: "Config" },
      { key: "soporte", icon: "wrench", label: "Soporte TI" },
      { key: "perfil", icon: "user", label: "Mi perfil" },
    ],
    psicologa: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard" },
      { key: "ai", icon: "ai", label: "AI Engine" },
      { key: "seguimiento", icon: "target", label: "Seguimiento" },
      { key: "confidenciales", icon: "lock", label: "Reportes Confidenciales" },
      { key: "empleados", icon: "users", label: "Empleados" },
      { key: "expedientes", icon: "folder", label: "Expedientes" },
      { key: "mensajes", icon: "message", label: "Mensajes" },
      { key: "soporte", icon: "wrench", label: "Soporte TI" },
      { key: "perfil", icon: "user", label: "Mi perfil" },
    ],
    rh: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard RH" },
      { key: "asistencia", icon: "clock", label: "Asistencia" },
      { key: "usuarios", icon: "userCog", label: "Gestión de Personal" },
      { key: "empleados", icon: "users", label: "Empleados" },
      { key: "vacaciones", icon: "vacation", label: "Vacaciones" },
      { key: "permisos", icon: "clipboardCheck", label: "Permisos" },
      { key: "horarios", icon: "calendarDays", label: "Horarios" },
      { key: "importar-horarios", icon: "file", label: "Importar horarios" },
      { key: "rostros", icon: "camera", label: "Rostros" },
      { key: "descuentos", icon: "dollar", label: "Descuentos" },
      { key: "calendario", icon: "calendar", label: "Calendario" },
      { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos" },
      { key: "reportesrh", icon: "trending", label: "Reportes RH" },
      { key: "bolsa", icon: "briefcase", label: "Bolsa de trabajo" },
      { key: "soporte", icon: "wrench", label: "Soporte TI" },
      { key: "perfil", icon: "user", label: "Mi perfil" },
    ],
    empleado: [
      { key: "inicio", icon: "home", label: "Inicio" },
      // En posición 2 a propósito: los 4 primeros items son la tabbar del móvil, y el
      // checador es lo único de esta lista que se usa TODOS los días, dos veces.
      { key: "checador", icon: "clock", label: "Checador" },
      { key: "encuesta", icon: "clipboardCheck", label: "Mi Encuesta" },
      { key: "historial", icon: "history", label: "Historial" },
      { key: "rostro", icon: "camera", label: "Mi rostro" },
      { key: "permisosempleado", icon: "vacation", label: "Vacaciones" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos" },
      { key: "reporteconfidencial", icon: "lock", label: "Reporte Confidencial" },
      { key: "soporte", icon: "wrench", label: "Soporte TI" },
      { key: "mensajes", icon: "message", label: "Mensajes" },
      { key: "perfil", icon: "user", label: "Mi perfil" },
    ],
  };

  const items = navItems[user?.role] || [];

  const [masOpen, setMasOpen] = useState(false);
  const PRIMARIOS = 4;
  const tabsPrincipales = items.slice(0, PRIMARIOS);
  const tabsExtra = items.slice(PRIMARIOS);
  const irA = (key) => { setMasOpen(false); navigate(`/${user.role}/${key}`); };
  const extraActivo = tabsExtra.some((i) => i.key === active);

  const handleLogout = async () => {
    const ok = await notify.confirm({
      title: "Cerrar sesión",
      description: "¿Seguro que quieres cerrar tu sesión?",
      variant: "danger",
      confirmText: "Cerrar sesión",
    });
    if (ok) logout();
  };

  return (
    <>
    <aside className={`sidebar${collapsed ? " sidebar--rail" : ""}`}>
      <button
        type="button"
        className="sidebar-rail-toggle"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? "Expandir menú" : "Colapsar menú"}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        aria-pressed={collapsed}
      >
        <span className="sidebar-rail-chevron" aria-hidden="true" />
      </button>

      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <img src={logoSmall} alt="McDental Pulse" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">McDental Pulse</span>
            <span className="sidebar-brand-sub">Bienestar organizacional</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item, i) => {
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
              style={{ "--i": i }}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebarActivePill"
                  className="sidebar-pill"
                  transition={pillTransition}
                  aria-hidden="true"
                />
              )}
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
        <button
          type="button"
          className="sidebar-user sidebar-user--link"
          onClick={() => navigate(`/${user.role}/perfil`)}
          title="Ver mi perfil"
          aria-label="Ver mi perfil"
        >
          <Avatar name={user?.name || ""} size={36} color="var(--mc-stat-teal-2)" photoUrl={user?.avatarUrl} />
          <div className="sidebar-user-text" style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">{user?.name?.split(" ")[0] || ""}</div>
            <div className="sidebar-user-role">{user?.role || ""}</div>
          </div>
        </button>
        <button
          type="button"
          className="sidebar-theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
          <span className="sidebar-logout-label">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
        </button>
        <button type="button" className="sidebar-logout" onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión">
          <Icon name="logout" size={14} />
          <span className="sidebar-logout-label">Cerrar sesión</span>
        </button>
      </div>
    </aside>

    {/* Navegación móvil: barra inferior con tabs + "Más" */}
    <nav className="mobile-tabbar" aria-label="Navegación principal">
      {tabsPrincipales.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={`mobile-tab${isActive ? " mobile-tab--active" : ""}`}
            onClick={() => irA(item.key)}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && (
              <motion.span
                layoutId="mobileTabPill"
                className="mobile-tab-pill"
                transition={pillTransition}
                aria-hidden="true"
              />
            )}
            <Icon name={item.icon} size={20} />
            <span className="mobile-tab-label">{item.label}</span>
          </button>
        );
      })}
      {tabsExtra.length > 0 && (
        <button
          type="button"
          className={`mobile-tab${masOpen || extraActivo ? " mobile-tab--active" : ""}`}
          onClick={() => setMasOpen((v) => !v)}
          aria-expanded={masOpen}
        >
          <Icon name="settings" size={20} />
          <span className="mobile-tab-label">Más</span>
        </button>
      )}
    </nav>

    {/* Hoja "Más": resto de secciones + usuario + cerrar sesión */}
    <AnimatePresence>
      {masOpen && (
        <motion.div
          className="mobile-sheet-overlay"
          onClick={() => setMasOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="mobile-sheet"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 32 }}
          >
            <div className="mobile-sheet-handle" />
            <button
              type="button"
              className="mobile-sheet-user mobile-sheet-user--link"
              onClick={() => irA("perfil")}
              aria-label="Ver mi perfil"
            >
              <Avatar name={user?.name || ""} size={40} color="var(--mc-stat-teal-2)" photoUrl={user?.avatarUrl} />
              <div style={{ minWidth: 0 }}>
                <div className="sidebar-user-name">{user?.name?.split(" ")[0] || ""}</div>
                <div className="sidebar-user-role">{user?.role || ""}</div>
              </div>
              <Icon name="user" size={16} className="mobile-sheet-user-chevron" />
            </button>
            <div className="mobile-sheet-list">
              {tabsExtra.map((item) => {
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`mobile-sheet-item${isActive ? " mobile-sheet-item--active" : ""}`}
                    onClick={() => irA(item.key)}
                  >
                    <span className="mobile-sheet-icon"><Icon name={item.icon} size={18} /></span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="mobile-sheet-logout mobile-sheet-theme" onClick={toggleTheme} style={{ marginBottom: 8 }}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={16} /> {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
            <button type="button" className="mobile-sheet-logout" onClick={handleLogout}>
              <Icon name="logout" size={16} /> Cerrar sesión
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default Sidebar;
