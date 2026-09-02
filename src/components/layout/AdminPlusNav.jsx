import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobal } from "../../contexts/GlobalContext";
import { useTheme } from "../../contexts/ThemeContext";
import { notify } from "../../utils/notify";
import { NAV_ITEMS, navItemsPara, agruparPorCampo } from "../../config/navItems";
import { setModuloRol } from "../../services/supabase/modulosRolService";
import logoSmall from "../../assets/logos/logo-small.png";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import BuscadorGlobal from "./BuscadorGlobal";
import BotonMensajes from "./BotonMensajes";
import BotonReuniones from "./BotonReuniones";
import CampanaNotificaciones from "../notificaciones/CampanaNotificaciones";

// Barra de Admin+: en vez de las categorías de siempre, 5 desplegables por ROL (Usuario/
// Doctor/RH/Psicóloga/Admin) para prender/apagar módulos GLOBALMENTE (todos los de ese rol
// a la vez — el control por persona sigue siendo ModulosPanel, aparte), y un 6º desplegable
// "Módulos" con las pantallas propias de Admin+, para no perder acceso a lo de siempre.
//
// Los 5 de rol son SOLO de administración: Admin+ no puede "entrar" a ver la pantalla de un
// doctor (esta sesión solo tiene montadas las rutas /admin/*, App.jsx), así que esas filas no
// navegan a ningún lado, solo alternan el interruptor. El desplegable "Módulos" sí navega —
// son las pantallas de Admin+ mismo.
const ROLES_GESTIONABLES = [
  { rol: "empleado", etiqueta: "Usuario", icon: "user" },
  { rol: "doctor", etiqueta: "Doctor", icon: "heart" },
  { rol: "rh", etiqueta: "RH", icon: "briefcase" },
  { rol: "psicologa", etiqueta: "Psicóloga", icon: "brain" },
  { rol: "admin", etiqueta: "Admin", icon: "shield" },
];

// Los 7 ítems que además de esconderse del menú, de verdad bloquean el acceso (mig. 148) —
// el resto solo desaparece de la barra, la RLS de esas pantallas no cambia (documentado en
// el plan). Se marca para que quede claro cuál interruptor es "de a de veras".
const CON_CANDADO_REAL = new Set(["comisiones", "checador", "notas", "departamentos", "avisos", "encuestas", "encuesta"]);

export default function AdminPlusNav() {
  const { user, logout } = useAuth();
  const { modulosRol, setModulosRol } = useGlobal();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.split("/").pop() || "";

  const [abierto, setAbierto] = useState(null); // 'empleado' | 'doctor' | ... | 'modulos' | 'usuario' | null
  const [guardando, setGuardando] = useState(null); // `${rol}:${key}` en curso
  const navRef = useRef(null);

  const itemsPropios = navItemsPara(user, modulosRol);
  const soporte = itemsPropios.find((i) => i.key === "soporte");

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setAbierto(null); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  useEffect(() => { document.querySelector(".app-main")?.scrollTo({ top: 0 }); }, [location.pathname]);

  const ir = (key) => { setAbierto(null); navigate(`/admin/${key}`); };

  const cerrarSesion = async () => {
    setAbierto(null);
    const ok = await notify.confirm({
      title: "Cerrar sesión", description: "¿Seguro que quieres cerrar tu sesión?",
      variant: "danger", confirmText: "Cerrar sesión",
    });
    if (ok) logout();
  };

  const activoPara = (rol, key) => modulosRol?.[rol]?.[key] !== false;

  const alternar = async (rol, key) => {
    const clave = `${rol}:${key}`;
    const nuevoValor = !activoPara(rol, key);
    setGuardando(clave);
    // Optimista: se actualiza local antes de que vuelva el servidor, como en ModulosPanel.
    setModulosRol((prev) => ({ ...prev, [rol]: { ...prev[rol], [key]: nuevoValor } }));
    try {
      await setModuloRol(rol, key, nuevoValor);
    } catch (error) {
      // Revertir si falló.
      setModulosRol((prev) => ({ ...prev, [rol]: { ...prev[rol], [key]: !nuevoValor } }));
      notify.toast.error(error?.message || "No se pudo guardar el cambio.");
    } finally {
      setGuardando(null);
    }
  };

  return (
    <header className="topnav" ref={navRef}>
      <div className="topnav-top">
        <button type="button" className="topnav-brand" onClick={() => ir("dashboard")}>
          <img src={logoSmall} alt="McDental Pulse" className="topnav-logo" />
          <span className="topnav-brand-text">McDental Pulse</span>
        </button>

        <div className="topnav-search-slot"><BuscadorGlobal /></div>

        <div className="topnav-top-right">
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
                <button type="button" className="topnav-menu-item" onClick={() => ir("config")}>
                  <Icon name="settings" size={16} /> Configuración
                </button>
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
                <div className="cuenta-sep" />
                <button type="button" className="topnav-menu-item topnav-menu-item--danger" onClick={cerrarSesion}>
                  <Icon name="logout" size={16} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="topnav-nav-row">
        <nav className="topnav-links" aria-label="Módulos por rol">
          {ROLES_GESTIONABLES.map(({ rol, etiqueta, icon }) => (
            <div className="topnav-drop" key={rol}>
              <button
                type="button"
                className={`topnav-link${abierto === rol ? " topnav-link--abierto" : ""}`}
                onClick={() => setAbierto((a) => (a === rol ? null : rol))}
                aria-expanded={abierto === rol}
              >
                <Icon name={icon} size={16} /> <span>{etiqueta}</span> <Icon name="chevronDown" size={15} className="topnav-caret" />
              </button>
              {abierto === rol && (
                <div className="topnav-menu topnav-menu--rol">
                  {agruparPorCampo(NAV_ITEMS[rol] || []).map((g) => (
                    <div key={g.nombre || "_sin"} className="topnav-menu-grupo">
                      {g.nombre && <div className="topnav-movil-titulo">{g.nombre}</div>}
                      {g.items.map((item) => (
                        <div key={item.key} className="topnav-menu-item cuenta-switch-row">
                          <span className="cuenta-switch-label">
                            <Icon name={item.icon} size={16} /> {item.label}
                            {CON_CANDADO_REAL.has(item.key) && (
                              <Icon name="lock" size={12} title="Este sí bloquea el acceso, no solo esconde el menú" />
                            )}
                          </span>
                          <button
                            type="button"
                            className={`cuenta-switch${activoPara(rol, item.key) ? " cuenta-switch--on" : ""}`}
                            aria-label={`${item.label} para ${etiqueta}`}
                            disabled={guardando === `${rol}:${item.key}`}
                            onClick={() => alternar(rol, item.key)}
                          >
                            <span />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="topnav-drop">
            <button
              type="button"
              className={`topnav-link${abierto === "modulos" ? " topnav-link--abierto" : ""}`}
              onClick={() => setAbierto((a) => (a === "modulos" ? null : "modulos"))}
              aria-expanded={abierto === "modulos"}
            >
              <Icon name="shield" size={16} /> <span>Módulos</span> <Icon name="chevronDown" size={15} className="topnav-caret" />
            </button>
            {abierto === "modulos" && (
              <div className="topnav-menu topnav-menu--rol">
                {agruparPorCampo(itemsPropios.filter((i) => i.group !== "Cuenta")).map((g) => (
                  <div key={g.nombre || "_sin"} className="topnav-menu-grupo">
                    {g.nombre && <div className="topnav-movil-titulo">{g.nombre}</div>}
                    {g.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`topnav-menu-item${active === item.key ? " topnav-menu-item--activo" : ""}`}
                        onClick={() => ir(item.key)}
                      >
                        <Icon name={item.icon} size={16} /> {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
