import { useSyncExternalStore } from "react";
import { useAuth } from "../../contexts/AuthContext";
import HeaderNav from "./HeaderNav";
import AdminPlusNav from "./AdminPlusNav";
import Sidebar from "./Sidebar";
import BotonMensajes from "./BotonMensajes";
import BotonReuniones from "./BotonReuniones";
import CampanaNotificaciones from "../notificaciones/CampanaNotificaciones";
import { TABS_MOVIL } from "../../config/navItems";

// Elige la navegación según el ancho: en ESCRITORIO (>1024px) el header nuevo con categorías; en
// TELÉFONO/TABLET (≤1024px, cubre iPad en vertical) la navegación de siempre — barra de pestañas
// abajo (Sidebar) + campana flotante. Se renderiza una sola (no CSS-hide) para no duplicar
// suscripciones ni componentes.
const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 1024px)") : null;

const useEsMovil = () =>
  useSyncExternalStore(
    (cb) => { mq?.addEventListener("change", cb); return () => mq?.removeEventListener("change", cb); },
    () => mq?.matches ?? false,
    () => false,
  );

export default function Navegacion() {
  const { user } = useAuth();
  const esMovil = useEsMovil();

  if (esMovil) {
    // Los roles con checador lo pintan como círculo central en la barra inferior (Sidebar.jsx) y
    // eso deja un hueco libre que se le da a Mensajes ahí mismo — ya no necesita ir arriba. Admin y
    // admin_plus no tienen checador ni ese hueco, así que Mensajes se queda arriba para ellos.
    const tieneChecadorCentral = (TABS_MOVIL[user?.role] || []).includes("checador");
    return (
      <>
        {/* El buscador del teléfono ya no va suelto acá: vive DENTRO de la barra de abajo
            (Sidebar.jsx), como una fila propia debajo de los tabs. */}
        <Sidebar />
        {/* Antes cada botón flotaba por su cuenta (position:fixed suelto, uno junto al otro a
            fuerza de calcular "right" a mano) y se veían como iconos sueltos encima del
            contenido. Ahora comparten UNA barra fija (mismo patrón que ya usa el header de
            escritorio con `.topnav-top-right`), con `gap` en vez de offsets a mano. */}
        <div className="mobile-topbar">
          {!tieneChecadorCentral && <BotonMensajes />}
          <BotonReuniones />
          <CampanaNotificaciones user={user} />
        </div>
      </>
    );
  }
  // Barra propia para Admin+ (pedido del dueño): navega por rol para prender/apagar módulos
  // globalmente, en vez de las categorías de siempre — ver AdminPlusNav.jsx.
  if (user?.role === "admin_plus") return <AdminPlusNav />;
  return <HeaderNav />;
}
