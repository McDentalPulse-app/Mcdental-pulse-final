import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { notify } from "../../utils/notify";
import { navItemsPara, GROUP_ICONS, agruparPorCampo, tieneBotonPropio } from "../../config/navItems";
import logoSmall from "../../assets/logos/logo-small.png";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import BuscadorGlobal from "./BuscadorGlobal";
import BotonMensajes from "./BotonMensajes";
import BotonReuniones from "./BotonReuniones";
import CampanaNotificaciones from "../notificaciones/CampanaNotificaciones";

// Navegación en HEADER horizontal (reemplaza el sidebar). Los ítems sueltos son enlaces directos;
// los agrupados van en menús desplegables por grupo. El perfil y cerrar sesión, en el menú del
// usuario (derecha). En móvil, un botón hamburguesa abre el panel con todo agrupado.
export default function HeaderNav() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.split("/").pop() || "";

  const [abierto, setAbierto] = useState(null); // nombre de grupo | 'usuario' | null
  const [movilOpen, setMovilOpen] = useState(false);
  const navRef = useRef(null);

  const items = navItemsPara(user);
  // Mensajes y Reuniones se sacan de la barra y del panel móvil: los representan SOLO sus botones
  // permanentes de la derecha (junto a la campana). Pintarlos también como enlace daría dos
  // entradas para lo mismo en escritorio, y el icono con su indicador se reconoce mejor que un
  // enlace de texto — además de ser lo único que sigue visible por debajo de 1100 px, donde la
  // barra se oculta. La lista de cuáles vive en navItems.js, junto a los ítems.
  const sueltos = items.filter((i) => !i.group && !tieneBotonPropio(i));
  const gruposBarra = agruparPorCampo(items.filter((i) => i.group && i.group !== "Cuenta"));
  const cuenta = items.filter((i) => i.group === "Cuenta");
  // El menu del usuario tambien ofrece soporte: el rotulo sale del item, no fijo, porque
  // segun el rol es "Soporte TI" (empleado/doctor) o "Ideas de mejora" (gestion).
  const soporte = items.find((i) => i.key === "soporte");
  const gruposMovil = agruparPorCampo(items.filter((i) => i.group !== "Cuenta" && !tieneBotonPropio(i)));

  // Cerrar dropdown al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setAbierto(null); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // Volver arriba al cambiar de pantalla.
  useEffect(() => { document.querySelector(".app-main")?.scrollTo({ top: 0 }); }, [location.pathname]);

  const ir = (key) => { setAbierto(null); setMovilOpen(false); navigate(`/${user.role}/${key}`); };

  const cerrarSesion = async () => {
    setAbierto(null); setMovilOpen(false);
    const ok = await notify.confirm({
      title: "Cerrar sesión", description: "¿Seguro que quieres cerrar tu sesión?",
      variant: "danger", confirmText: "Cerrar sesión",
    });
    if (ok) logout();
  };

  const grupoActivo = (its) => its.some((i) => i.key === active);

  return (
    <header className="topnav">
      <div className="topnav-inner" ref={navRef}>
        <button type="button" className="topnav-brand" onClick={() => ir(sueltos[0]?.key || "dashboard")}>
          <img src={logoSmall} alt="McDental Pulse" className="topnav-logo" />
          <span className="topnav-brand-text">McDental Pulse</span>
        </button>

        <nav className="topnav-links" aria-label="Navegación principal">
          {sueltos.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`topnav-link${active === item.key ? " topnav-link--activo" : ""}`}
              onClick={() => ir(item.key)}
            >
              <Icon name={item.icon} size={16} /> <span>{item.label}</span>
            </button>
          ))}

          {gruposBarra.map((g) => (
            <div className="topnav-drop" key={g.nombre}>
              <button
                type="button"
                className={`topnav-link${grupoActivo(g.items) ? " topnav-link--activo" : ""}${abierto === g.nombre ? " topnav-link--abierto" : ""}`}
                onClick={() => setAbierto((a) => (a === g.nombre ? null : g.nombre))}
                aria-expanded={abierto === g.nombre}
              >
                <Icon name={GROUP_ICONS[g.nombre]} size={16} /> <span>{g.nombre}</span> <Icon name="chevronDown" size={15} className="topnav-caret" />
              </button>
              {abierto === g.nombre && (
                <div className="topnav-menu">
                  {/* Icono + título + una línea de qué se hace ahí. El menú se lee para decidir
                      a dónde ir, y "Calibración del cotejo" o "Intercambios de día" no dicen por
                      sí solos si son lo que buscas. Un ítem sin `desc` se sigue viendo como
                      antes: la clase --condesc solo se pone cuando hay algo que enseñar. */}
                  {g.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`topnav-menu-item${item.desc ? " topnav-menu-item--condesc" : ""}${active === item.key ? " topnav-menu-item--activo" : ""}`}
                      onClick={() => ir(item.key)}
                    >
                      <Icon name={item.icon} size={16} />
                      {item.desc ? (
                        <span className="topnav-menu-texto">
                          <span className="topnav-menu-titulo">{item.label}</span>
                          <span className="topnav-menu-desc">{item.desc}</span>
                        </span>
                      ) : (
                        item.label
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="topnav-right">
          <BuscadorGlobal />

          <BotonMensajes activo={active === "mensajes"} />

          <BotonReuniones activo={active === "reuniones"} />

          <CampanaNotificaciones user={user} />

          <div className="topnav-drop">
            <button type="button" className="topnav-user" onClick={() => setAbierto((a) => (a === "usuario" ? null : "usuario"))} aria-expanded={abierto === "usuario"}>
              <Avatar name={user?.name || ""} size={32} color="var(--mc-stat-teal-2)" photoUrl={user?.avatarUrl} zoom={false} />
              <span className="topnav-user-info">
                <span className="topnav-user-name">{user?.name?.split(" ")[0] || ""}</span>
                <span className="topnav-user-role">{user?.role || ""}</span>
              </span>
              <Icon name="chevronDown" size={15} className="topnav-caret" />
            </button>
            {abierto === "usuario" && (
              <div className="topnav-menu topnav-menu--der cuenta-menu">
                <div className="cuenta-head">
                  <span className="cuenta-avatar">
                    <Avatar name={user?.name || ""} size={40} color="var(--mc-stat-teal-2)" photoUrl={user?.avatarUrl} />
                    <span className="cuenta-online" aria-hidden="true" />
                  </span>
                  <span className="cuenta-info">
                    <span className="cuenta-nombre">{user?.name}</span>
                    <span className="cuenta-email">{user?.email || user?.puesto || user?.role}</span>
                  </span>
                </div>

                <button type="button" className="topnav-menu-item" onClick={() => ir("perfil")}>
                  <Icon name="user" size={16} /> Mi perfil
                </button>
                {items.some((i) => i.key === "config") && (
                  <button type="button" className="topnav-menu-item" onClick={() => ir("config")}>
                    <Icon name="settings" size={16} /> Configuración
                  </button>
                )}
                <button type="button" className="topnav-menu-item cuenta-switch-row" onClick={toggleTheme}>
                  <span className="cuenta-switch-label"><Icon name="moon" size={16} /> Modo oscuro</span>
                  <span className={`cuenta-switch${theme === "dark" ? " cuenta-switch--on" : ""}`} aria-hidden="true"><span /></span>
                </button>

                <div className="cuenta-sep" />
                {soporte && (
                  <button type="button" className="topnav-menu-item" onClick={() => ir("soporte")}>
                    <Icon name={soporte.icon} size={16} /> {soporte.label}
                  </button>
                )}
                {items.some((i) => i.key === "avisos") && (
                  <button type="button" className="topnav-menu-item" onClick={() => ir("avisos")}>
                    <Icon name="bell" size={16} /> Avisos
                  </button>
                )}

                <div className="cuenta-sep" />
                <button type="button" className="topnav-menu-item topnav-menu-item--danger" onClick={cerrarSesion}>
                  <Icon name="logout" size={16} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>

          <button type="button" className="topnav-hamburguesa" onClick={() => setMovilOpen((v) => !v)} aria-label="Menú" aria-expanded={movilOpen}>
            <span /><span /><span />
          </button>
        </div>
      </div>

      {movilOpen && (
        <div className="topnav-movil-overlay" onClick={() => setMovilOpen(false)}>
          <nav className="topnav-movil" onClick={(e) => e.stopPropagation()}>
            {gruposMovil.map((g, gi) => (
              <div className="topnav-movil-grupo" key={g.nombre || `sin-${gi}`}>
                {g.nombre && <div className="topnav-movil-titulo">{g.nombre}</div>}
                {g.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`topnav-movil-item${active === item.key ? " topnav-movil-item--activo" : ""}`}
                    onClick={() => ir(item.key)}
                  >
                    <Icon name={item.icon} size={18} /> {item.label}
                  </button>
                ))}
              </div>
            ))}
            <div className="topnav-movil-grupo">
              {cuenta.map((item) => (
                <button key={item.key} type="button" className="topnav-movil-item" onClick={() => ir(item.key)}>
                  <Icon name={item.icon} size={18} /> {item.label}
                </button>
              ))}
              <button type="button" className="topnav-movil-item cuenta-switch-row" onClick={toggleTheme}>
                <span className="cuenta-switch-label"><Icon name="moon" size={18} /> Modo oscuro</span>
                <span className={`cuenta-switch${theme === "dark" ? " cuenta-switch--on" : ""}`} aria-hidden="true"><span /></span>
              </button>
              <button type="button" className="topnav-movil-item topnav-movil-item--danger" onClick={cerrarSesion}>
                <Icon name="logout" size={18} /> Cerrar sesión
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
