import { useState, useEffect, useLayoutEffect, useRef, Fragment } from "react";
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

// Navegación en HEADER horizontal, en dos pisos (opción B elegida por el dueño tras ver 3
// propuestas): arriba una franja delgada con marca, buscador y acciones; abajo una fila
// dedicada solo a los enlaces, con todo el ancho de la pantalla para sí sola — así "Más" casi
// nunca hace falta, en vez de competir por espacio con el logo y el buscador en una sola fila.
// Los ítems sueltos son enlaces directos; los agrupados van en menús desplegables por grupo. El
// perfil y cerrar sesión, en el menú del usuario (derecha). En móvil, un botón hamburguesa abre
// el panel con todo agrupado.
export default function HeaderNav() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.split("/").pop() || "";

  const [abierto, setAbierto] = useState(null); // nombre de grupo | 'usuario' | 'mas' | null
  const [movilOpen, setMovilOpen] = useState(false);
  const navRef = useRef(null);

  const items = navItemsPara(user);
  // Cuántas entradas (sueltas + grupos) caben en una sola línea antes de que el resto se
  // junte en "Más". Arranca en "todas caben" para no parpadear un "Más" vacío en el primer
  // frame; useLayoutEffect lo corrige antes de pintar si hace falta.
  const [visibleCount, setVisibleCount] = useState(Infinity);
  const linksRef = useRef(null); // el <nav> real, de donde se lee el ancho disponible
  const medidaRefs = useRef([]); // anchos de cada entrada, leídos de la fila oculta de medición
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

  // Todo lo que va en la barra horizontal, en el orden en que se pinta: sueltos primero,
  // luego los grupos. Lo que no entra en una línea se junta al final en "Más" — reemplaza
  // al envolver-a-segunda-línea de antes, que en roles con muchos grupos (psicóloga: 7) se
  // veía como una barra de dos pisos.
  const entradas = [
    ...sueltos.map((item) => ({ tipo: "link", key: item.key, item })),
    ...gruposBarra.map((g) => ({ tipo: "grupo", key: g.nombre, grupo: g })),
  ];
  const visibles = entradas.slice(0, visibleCount);
  const ocultas = entradas.slice(visibleCount);

  // Mide cada entrada en una fila invisible (mismos estilos, sin `flex-wrap`, así que su
  // ancho natural no depende de si al final cabe o no) y decide cuántas entran antes de
  // reservar sitio para el botón "Más". `useLayoutEffect` porque tiene que resolverse ANTES
  // de pintar — con `useEffect` se vería un parpadeo de la barra completa desbordada.
  useLayoutEffect(() => {
    const contenedor = linksRef.current;
    if (!contenedor) return undefined;
    const ANCHO_MAS = 84; // botón "Más ▾" con margen de sobra — no vale la pena medirlo también
    const recalcular = () => {
      const disponible = contenedor.clientWidth;
      const anchos = entradas.map((_, i) => medidaRefs.current[i]?.offsetWidth ?? 0);
      const total = anchos.reduce((a, b) => a + b, 0);
      // Primero se prueba SIN reservar nada para "Más": si todo cabe de sobra, no hace
      // falta el botón y no hay que restarle su espacio a nadie. Reservarlo siempre,
      // incluso cuando al final todo iba a caber, cortaba de más — un ítem de en medio
      // hacía fallar la cuenta aunque el último, más angosto, sí hubiera cabido.
      if (total <= disponible) { setVisibleCount(entradas.length); return; }
      let acumulado = 0;
      let corte = 0;
      for (let i = 0; i < entradas.length; i++) {
        if (acumulado + anchos[i] + ANCHO_MAS > disponible) break;
        acumulado += anchos[i];
        corte = i + 1;
      }
      setVisibleCount(corte);
    };
    recalcular();
    const ro = new ResizeObserver(recalcular);
    ro.observe(contenedor);
    return () => ro.disconnect();
    // `entradas` es un array nuevo en cada render (se arma con .filter/.map arriba), así que
    // meterlo tal cual en las deps haría correr esto en CADA render sin motivo — lo que
    // realmente lo cambia es el rol de quien entró (uno solo por sesión, cambia al hacer
    // login/logout) o que la lista de ítems crezca/encoja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entradas.length, user?.role]);

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
  // Si la pantalla activa vive en algo que quedó escondido en "Más", el botón "Más" también
  // se marca activo — si no, la persona pierde la pista de dónde está parada.
  const masActivo = ocultas.some((e) => (e.tipo === "link" ? e.key === active : grupoActivo(e.grupo.items)));

  const entradaTpl = (e) => (
    e.tipo === "link" ? (
      <button
        type="button"
        className={`topnav-link${active === e.item.key ? " topnav-link--activo" : ""}`}
        onClick={() => ir(e.item.key)}
      >
        <Icon name={e.item.icon} size={16} /> <span>{e.item.label}</span>
      </button>
    ) : (
      <div className="topnav-drop">
        <button
          type="button"
          className={`topnav-link${grupoActivo(e.grupo.items) ? " topnav-link--activo" : ""}${abierto === e.grupo.nombre ? " topnav-link--abierto" : ""}`}
          onClick={() => setAbierto((a) => (a === e.grupo.nombre ? null : e.grupo.nombre))}
          aria-expanded={abierto === e.grupo.nombre}
        >
          <Icon name={GROUP_ICONS[e.grupo.nombre]} size={16} /> <span>{e.grupo.nombre}</span> <Icon name="chevronDown" size={15} className="topnav-caret" />
        </button>
        {abierto === e.grupo.nombre && (
          <div className="topnav-menu">
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
  );

  return (
    <header className="topnav" ref={navRef}>
      <div className="topnav-top">
        <button type="button" className="topnav-brand" onClick={() => ir(sueltos[0]?.key || "dashboard")}>
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

      <div className="topnav-nav-row">
        <nav className="topnav-links" aria-label="Navegación principal" ref={linksRef}>
          {visibles.map((e) => <Fragment key={e.key}>{entradaTpl(e)}</Fragment>)}

          {ocultas.length > 0 && (
            <div className="topnav-drop">
              <button
                type="button"
                className={`topnav-link${masActivo ? " topnav-link--activo" : ""}${abierto === "mas" ? " topnav-link--abierto" : ""}`}
                onClick={() => setAbierto((a) => (a === "mas" ? null : "mas"))}
                aria-expanded={abierto === "mas"}
              >
                <span>Más</span> <Icon name="chevronDown" size={15} className="topnav-caret" />
              </button>
              {abierto === "mas" && (
                <div className="topnav-menu">
                  {ocultas.map((e) => e.tipo === "link" ? (
                    <button
                      key={e.key}
                      type="button"
                      className={`topnav-menu-item${active === e.item.key ? " topnav-menu-item--activo" : ""}`}
                      onClick={() => ir(e.item.key)}
                    >
                      <Icon name={e.item.icon} size={16} /> {e.item.label}
                    </button>
                  ) : (
                    <div key={e.key}>
                      {/* Rótulo del grupo: sin esto, dos grupos escondidos en "Más" se ven
                          como una sola lista revuelta y no se distingue dónde empieza cada uno. */}
                      <div className="topnav-movil-titulo">{e.grupo.nombre}</div>
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
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Fila de medición: invisible, sin flex-wrap, mismos estilos — así cada entrada
            enseña su ancho REAL sin importar si al final le toca caber o no. */}
        <div className="topnav-medidor" aria-hidden="true">
          {entradas.map((e, i) => (
            <div key={e.key} ref={(el) => { medidaRefs.current[i] = el; }}>{entradaTpl(e)}</div>
          ))}
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
