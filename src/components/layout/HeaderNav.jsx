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

// Riel lateral (reemplaza la barra horizontal de arriba, paso 1 del rediseño). Los ítems
// sueltos y los grupos son un ícono cada uno, apilados en columna — a diferencia de una
// barra horizontal, un riel no compite por ancho: no hace falta medir cuántos caben ni
// juntar el resto en "Más" (psicóloga, con 7 grupos, cabe entera sin trucos). Un grupo
// abre un panel flotante a la derecha de su ícono, en vez de un desplegable hacia abajo.
// En móvil, Navegacion.jsx sigue montando Sidebar en su lugar — esto no se toca.
export default function HeaderNav() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.split("/").pop() || "";

  const [abierto, setAbierto] = useState(null); // nombre de grupo | 'usuario' | null
  const railRef = useRef(null);

  const items = navItemsPara(user);
  const sueltos = items.filter((i) => !i.group && !tieneBotonPropio(i));
  const grupos = agruparPorCampo(items.filter((i) => i.group && i.group !== "Cuenta"));
  // El menu de cuenta tambien ofrece soporte: el rotulo sale del item, no fijo, porque
  // segun el rol es "Soporte TI" (empleado/doctor) o "Ideas de mejora" (gestion).
  const soporte = items.find((i) => i.key === "soporte");

  const entradas = [
    ...sueltos.map((item) => ({ tipo: "link", key: item.key, item })),
    ...grupos.map((g) => ({ tipo: "grupo", key: g.nombre, grupo: g })),
  ];

  // Cerrar el flyout al hacer clic fuera del riel.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (railRef.current && !railRef.current.contains(e.target)) setAbierto(null); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // Volver arriba al cambiar de pantalla.
  useEffect(() => { document.querySelector(".app-main")?.scrollTo({ top: 0 }); }, [location.pathname]);

  const ir = (key) => { setAbierto(null); navigate(`/${user.role}/${key}`); };

  const cerrarSesion = async () => {
    setAbierto(null);
    const ok = await notify.confirm({
      title: "Cerrar sesión", description: "¿Seguro que quieres cerrar tu sesión?",
      variant: "danger", confirmText: "Cerrar sesión",
    });
    if (ok) logout();
  };

  const grupoActivo = (its) => its.some((i) => i.key === active);
  const tituloActivo =
    items.find((i) => i.key === active)?.label
    || grupos.find((g) => grupoActivo(g.items))?.nombre
    || "";

  return (
    <>
      <nav className="pulse-rail" ref={railRef} aria-label="Navegación principal">
        <button type="button" className="pulse-rail-logo" onClick={() => ir(sueltos[0]?.key || "dashboard")} aria-label="Inicio">
          <img src={logoSmall} alt="" />
        </button>

        <div className="pulse-rail-lista">
          {entradas.map((e) =>
            e.tipo === "link" ? (
              <button
                key={e.key}
                type="button"
                className={`pulse-rail-item${active === e.item.key ? " pulse-rail-item--activo" : ""}`}
                onClick={() => ir(e.item.key)}
              >
                <Icon name={e.item.icon} size={20} />
                <span>{e.item.label}</span>
              </button>
            ) : (
              <div key={e.key} className="pulse-rail-drop">
                <button
                  type="button"
                  className={`pulse-rail-item${grupoActivo(e.grupo.items) ? " pulse-rail-item--activo" : ""}`}
                  onClick={() => setAbierto((a) => (a === e.grupo.nombre ? null : e.grupo.nombre))}
                  aria-expanded={abierto === e.grupo.nombre}
                >
                  <Icon name={GROUP_ICONS[e.grupo.nombre]} size={20} />
                  <span>{e.grupo.nombre}</span>
                </button>
                {abierto === e.grupo.nombre && (
                  <div className="pulse-flyout">
                    <div className="pulse-flyout-titulo">{e.grupo.nombre}</div>
                    {e.grupo.items.map((item) => (
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
            )
          )}
        </div>

        <div className="pulse-rail-drop pulse-rail-cuenta">
          <button
            type="button"
            className={`pulse-rail-item pulse-rail-item--avatar${abierto === "usuario" ? " pulse-rail-item--activo" : ""}`}
            onClick={() => setAbierto((a) => (a === "usuario" ? null : "usuario"))}
            aria-expanded={abierto === "usuario"}
          >
            <Avatar name={user?.name || ""} size={30} color="var(--mc-stat-teal-2)" photoUrl={user?.avatarUrl} zoom={false} />
          </button>
          {abierto === "usuario" && (
            <div className="pulse-flyout pulse-flyout--abajo cuenta-menu">
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
      </nav>

      <header className="pulse-topbar">
        <span className="pulse-topbar-titulo">{tituloActivo}</span>
        <BuscadorGlobal />
        <div className="pulse-topbar-acciones">
          <BotonMensajes activo={active === "mensajes"} />
          <BotonReuniones activo={active === "reuniones"} />
          <CampanaNotificaciones user={user} />
        </div>
      </header>
    </>
  );
}
