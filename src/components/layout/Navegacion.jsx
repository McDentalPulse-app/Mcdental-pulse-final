import { useSyncExternalStore } from "react";
import { useAuth } from "../../contexts/AuthContext";
import HeaderNav from "./HeaderNav";
import AdminPlusNav from "./AdminPlusNav";
import Sidebar from "./Sidebar";
import BotonMensajes from "./BotonMensajes";
import BotonReuniones from "./BotonReuniones";
import CampanaNotificaciones from "../notificaciones/CampanaNotificaciones";
import { TABS_MOVIL } from "../../config/navItems";

// Elige la navegación según el ancho: en ESCRITORIO (>768px) el header nuevo con categorías; en
// TELÉFONO (≤768px) la navegación de siempre — barra de pestañas abajo (Sidebar) + campana
// flotante. Se renderiza una sola (no CSS-hide) para no duplicar suscripciones ni componentes.
const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)") : null;

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
    // eso deja un hueco libre que se le da a Mensajes ahí mismo — ya no necesita flotar. Admin y
    // admin_plus no tienen checador ni ese hueco, así que Mensajes se queda flotante para ellos.
    const tieneChecadorCentral = (TABS_MOVIL[user?.role] || []).includes("checador");
    return (
      <>
        <Sidebar />
        {!tieneChecadorCentral && <BotonMensajes variante="flotante" />}
        <BotonReuniones variante="flotante" cerca={tieneChecadorCentral} />
        <CampanaNotificaciones user={user} />
      </>
    );
  }
  // Barra propia para Admin+ (pedido del dueño): navega por rol para prender/apagar módulos
  // globalmente, en vez de las categorías de siempre — ver AdminPlusNav.jsx.
  if (user?.role === "admin_plus") return <AdminPlusNav />;
  return <HeaderNav />;
}
