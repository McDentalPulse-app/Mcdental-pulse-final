import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useNavigate, useLocation } from "react-router-dom";
import { notify } from "../../utils/notify";
import logoSmall from "../../assets/logos/logo-small.png";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { NAV_ITEMS, TABS_MOVIL, agruparPorCampo } from "../../config/navItems";
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

  // Los menús salen de config/navItems.js, la MISMA fuente que usa el header de escritorio.
  // Hasta el 2026-07-29 este archivo tenía su propia copia escrita a mano, y por eso los grupos
  // nuevos y Mensajes se quedaron sin llegar al teléfono: se cambió una lista y había dos.
  const items = NAV_ITEMS[user?.role] || [];

  const [masOpen, setMasOpen] = useState(false);
  // La barra inferior se declara por clave y ya no depende del orden del arreglo: así reordenar el
  // menú para que se lea mejor no mueve los accesos que la gente usa sin mirar.
  const clavesTab = TABS_MOVIL[user?.role] || [];
  const tabsPrincipales = clavesTab
    .map((k) => items.find((i) => i.key === k))
    .filter(Boolean);
  // Mensajes queda fuera de la hoja "Más": en el teléfono es el botón flotante junto a la campana.
  const tabsExtra = items.filter(
    (i) => !clavesTab.includes(i.key) && i.key !== "mensajes",
  );
  const irA = (key) => { setMasOpen(false); navigate(`/${user.role}/${key}`); };
  const extraActivo = tabsExtra.some((i) => i.key === active);

  // Hoja "Más" del móvil: un ítem sin `group` que no esté en la tabbar cae en "Otros". Hoy no
  // ocurre en ningún rol —los sueltos de NAV_ITEMS son el inicio y Mensajes, y los dos salen por
  // otro lado— pero el encabezado existe para que un ítem nuevo no aparezca sin sección.
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
