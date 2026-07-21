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

  // Móvil: la tabbar flotante se esconde al hacer scroll hacia abajo y vuelve al subir. El
  // contenedor que scrollea es `.app-main`, no la ventana, así que se escucha ahí.
  const [navOculto, setNavOculto] = useState(false);
  useEffect(() => {
    const main = document.querySelector(".app-main");
    if (!main) return undefined;
    let ultimo = main.scrollTop;
    const onScroll = () => {
      const y = main.scrollTop;
      if (y > ultimo + 4 && y > 60) setNavOculto(true);        // bajando: esconder
      else if (y < ultimo - 4) setNavOculto(false);            // subiendo: mostrar
      ultimo = y;
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  // Al cambiar de pantalla, el contenido vuelve ARRIBA. Sin esto, la vista nueva heredaba el
  // scroll de la anterior: el título quedaba fuera de cuadro y parecía "bajar solo".
  useEffect(() => {
    document.querySelector(".app-main")?.scrollTo({ top: 0 });
  }, [location.pathname]);

  // `group` solo se usa en móvil (la hoja "Más"): agrupa los ítems que no caben en la
  // tabbar de 4 para que no sea una lista plana de 15-20 botones. El desktop lo ignora.
  const navItems = {
    admin: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard" },
      { key: "ai", icon: "ai", label: "AI Engine", group: "Herramientas" },
      { key: "empleados", icon: "users", label: "Empleados" },
      { key: "usuarios", icon: "userCog", label: "Gestión de Personal" },
      { key: "asistencia", icon: "clock", label: "Asistencia", group: "Asistencia y rostros" },
      { key: "sucursales", icon: "mapPin", label: "Sucursales", group: "Asistencia y rostros" },
      { key: "horarios", icon: "calendarDays", label: "Horarios", group: "Asistencia y rostros" },
      { key: "importar-horarios", icon: "file", label: "Importar horarios", group: "Asistencia y rostros" },
      { key: "calibracion", icon: "shield", label: "Calibración del cotejo", group: "Asistencia y rostros" },
      { key: "rostros", icon: "camera", label: "Rostros", group: "Asistencia y rostros" },
      { key: "expedientes", icon: "folder", label: "Expedientes", group: "Equipo" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Equipo" },
      { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios", group: "Equipo" },
      { key: "encuestas", icon: "clipboard", label: "Encuestas", group: "Encuestas y reportes" },
      { key: "reportes", icon: "trending", label: "Reportes", group: "Encuestas y reportes" },
      { key: "confidenciales", icon: "lock", label: "Reportes Confidenciales", group: "Encuestas y reportes" },
      { key: "config", icon: "settings", label: "Config", group: "Herramientas" },
      { key: "avisos", icon: "bell", label: "Avisos", group: "Herramientas" },
      { key: "soporte", icon: "wrench", label: "Soporte TI", group: "Herramientas" },
      { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
    ],
    // psicologa tiene paridad admin: conserva Seguimiento y Mensajes (lo suyo) y suma
    // el resto de opciones del admin.
    psicologa: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard" },
      // La psicóloga también marca su asistencia: el checador va arriba, a la vista.
      { key: "checador", icon: "clock", label: "Checador" },
      { key: "ai", icon: "ai", label: "AI Engine" },
      { key: "seguimiento", icon: "target", label: "Seguimiento" },
      { key: "confidenciales", icon: "lock", label: "Reportes Confidenciales" },
      // La psicóloga es jefa de RH: tiene también los paneles de RH (aprobar permisos/vacaciones).
      { key: "vacaciones", icon: "vacation", label: "Vacaciones", group: "Vacaciones y permisos" },
      { key: "permisos", icon: "clipboardCheck", label: "Permisos", group: "Vacaciones y permisos" },
      { key: "empleados", icon: "users", label: "Empleados", group: "Equipo" },
      { key: "usuarios", icon: "userCog", label: "Gestión de Personal", group: "Equipo" },
      { key: "asistencia", icon: "clock", label: "Asistencia", group: "Asistencia y rostros" },
      { key: "sucursales", icon: "mapPin", label: "Sucursales", group: "Asistencia y rostros" },
      { key: "horarios", icon: "calendarDays", label: "Horarios", group: "Asistencia y rostros" },
      { key: "importar-horarios", icon: "file", label: "Importar horarios", group: "Asistencia y rostros" },
      { key: "calibracion", icon: "shield", label: "Calibración del cotejo", group: "Asistencia y rostros" },
      { key: "rostros", icon: "camera", label: "Rostros", group: "Asistencia y rostros" },
      { key: "expedientes", icon: "folder", label: "Expedientes", group: "Equipo" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Equipo" },
      { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios", group: "Equipo" },
      { key: "encuestas", icon: "clipboard", label: "Encuestas", group: "Encuestas y reportes" },
      { key: "reportes", icon: "trending", label: "Reportes", group: "Encuestas y reportes" },
      { key: "config", icon: "settings", label: "Config", group: "Herramientas" },
      { key: "mensajes", icon: "message", label: "Mensajes", group: "Herramientas" },
      { key: "avisos", icon: "bell", label: "Avisos", group: "Herramientas" },
      { key: "soporte", icon: "wrench", label: "Soporte TI", group: "Herramientas" },
      { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
    ],
    // rh tiene paridad admin: conserva sus vistas propias (Vacaciones, Permisos,
    // Descuentos, Calendario, Reportes RH, Bolsa) y suma las opciones del admin.
    rh: [
      { key: "dashboard", icon: "dashboard", label: "Dashboard RH" },
      // RH también marca su asistencia: el checador va arriba, a la vista.
      { key: "checador", icon: "clock", label: "Checador" },
      { key: "usuarios", icon: "userCog", label: "Gestión de Personal" },
      { key: "empleados", icon: "users", label: "Empleados" },
      { key: "ai", icon: "ai", label: "AI Engine", group: "Herramientas" },
      { key: "vacaciones", icon: "vacation", label: "Vacaciones", group: "Vacaciones y permisos" },
      { key: "permisos", icon: "clipboardCheck", label: "Permisos", group: "Vacaciones y permisos" },
      { key: "asistencia", icon: "clock", label: "Asistencia", group: "Asistencia y rostros" },
      { key: "horarios", icon: "calendarDays", label: "Horarios", group: "Asistencia y rostros" },
      { key: "importar-horarios", icon: "file", label: "Importar horarios", group: "Asistencia y rostros" },
      { key: "calibracion", icon: "shield", label: "Calibración del cotejo", group: "Asistencia y rostros" },
      { key: "rostros", icon: "camera", label: "Rostros", group: "Asistencia y rostros" },
      { key: "sucursales", icon: "mapPin", label: "Sucursales", group: "Asistencia y rostros" },
      { key: "descuentos", icon: "dollar", label: "Descuentos", group: "RH" },
      { key: "calendario", icon: "calendar", label: "Calendario", group: "RH" },
      { key: "eventospersonal", icon: "cake", label: "Cumpleaños y Aniversarios", group: "Equipo" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Equipo" },
      { key: "expedientes", icon: "folder", label: "Expedientes", group: "Equipo" },
      { key: "encuestas", icon: "clipboard", label: "Encuestas", group: "Encuestas y reportes" },
      { key: "reportes", icon: "trending", label: "Reportes", group: "Encuestas y reportes" },
      { key: "reportesrh", icon: "trending", label: "Reportes RH", group: "RH" },
      { key: "bolsa", icon: "briefcase", label: "Bolsa de trabajo", group: "Equipo" },
      { key: "config", icon: "settings", label: "Config", group: "Herramientas" },
      { key: "avisos", icon: "bell", label: "Avisos", group: "Herramientas" },
      { key: "soporte", icon: "wrench", label: "Soporte TI", group: "Herramientas" },
      { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
    ],
    empleado: [
      { key: "inicio", icon: "home", label: "Inicio" },
      // En posición 2 a propósito: los 4 primeros items son la tabbar del móvil, y el
      // checador es lo único de esta lista que se usa TODOS los días, dos veces.
      { key: "checador", icon: "clock", label: "Checador" },
      { key: "encuesta", icon: "clipboardCheck", label: "Mi Encuesta" },
      { key: "historial", icon: "history", label: "Historial" },
      { key: "rostro", icon: "camera", label: "Mi rostro", group: "Mi trabajo" },
      { key: "permisosempleado", icon: "vacation", label: "Vacaciones", group: "Mi trabajo" },
      { key: "reconocimientos", icon: "award", label: "Reconocimientos", group: "Mi trabajo" },
      { key: "reporteconfidencial", icon: "lock", label: "Reporte Confidencial", group: "Mi trabajo" },
      { key: "soporte", icon: "wrench", label: "Soporte TI", group: "Herramientas" },
      { key: "mensajes", icon: "message", label: "Mensajes", group: "Herramientas" },
      { key: "avisos", icon: "bell", label: "Avisos", group: "Herramientas" },
      { key: "perfil", icon: "user", label: "Mi perfil", group: "Cuenta" },
    ],
  };

  const items = navItems[user?.role] || [];

  const [masOpen, setMasOpen] = useState(false);
  const PRIMARIOS = 4;
  const tabsPrincipales = items.slice(0, PRIMARIOS);
  const tabsExtra = items.slice(PRIMARIOS);
  const irA = (key) => { setMasOpen(false); navigate(`/${user.role}/${key}`); };
  const extraActivo = tabsExtra.some((i) => i.key === active);

  // Agrupa una lista de ítems por su campo `group`: las secciones salen en el orden en que
  // aparece su primer ítem, y cada ítem cae en su sección aunque estén repartidos en el
  // arreglo (p. ej. RH tiene Vacaciones/Permisos separados de Descuentos/Calendario). Los
  // ítems sin `group` van a un grupo sin nombre (sin encabezado al pintarlo).
  const agruparPorCampo = (lista) => {
    const grupos = [];
    const indice = new Map();
    for (const item of lista) {
      const grupo = item.group || null;
      if (!indice.has(grupo)) {
        indice.set(grupo, grupos.length);
        grupos.push({ nombre: grupo, items: [] });
      }
      grupos[indice.get(grupo)].items.push(item);
    }
    return grupos;
  };

  // Hoja "Más" del móvil: acá sí todo grupo sin nombre cae en "Otros" (no hay ítems sueltos
  // en esa hoja, los primeros 4 son la tabbar y nunca llegan a tabsExtra).
  const gruposExtra = agruparPorCampo(tabsExtra).map((g) => ({ ...g, nombre: g.nombre || "Otros" }));

  // Desktop: la lista completa, agrupada igual. Los ítems sin `group` (Dashboard y los 2-3
  // más usados de cada rol) quedan sueltos arriba sin encabezado — mismo criterio que ya
  // los hace la tabbar del móvil.
  const gruposDesktop = agruparPorCampo(items);

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
        {gruposDesktop.map((grupo, gi) => (
          <div key={grupo.nombre || `sin-seccion-${gi}`} className="sidebar-section">
            {grupo.nombre && <div className="sidebar-section-title">{grupo.nombre}</div>}
            {grupo.items.map((item) => {
              const i = items.indexOf(item);
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
          </div>
        ))}
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
    <nav className={`mobile-tabbar${navOculto ? " mobile-tabbar--oculto" : ""}`} aria-label="Navegación principal">
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
            <span className={`mobile-tab-ico${isActive ? " mobile-tab-ico--active" : ""}`}>
              <Icon name={item.icon} size={20} />
            </span>
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
          <span className={`mobile-tab-ico${masOpen || extraActivo ? " mobile-tab-ico--active" : ""}`}>
            <Icon name="settings" size={20} />
          </span>
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
              {gruposExtra.map((grupo) => (
                <div className="mobile-sheet-group" key={grupo.nombre}>
                  <div className="mobile-sheet-group-title">{grupo.nombre}</div>
                  {grupo.items.map((item) => {
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
              ))}
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
