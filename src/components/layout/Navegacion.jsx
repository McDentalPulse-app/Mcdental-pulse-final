import { useSyncExternalStore } from "react";
import { useAuth } from "../../contexts/AuthContext";
import HeaderNav from "./HeaderNav";
import Sidebar from "./Sidebar";
import BotonMensajes from "./BotonMensajes";
import BotonReuniones from "./BotonReuniones";
import CampanaNotificaciones from "../notificaciones/CampanaNotificaciones";

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
    return (
      <>
        <Sidebar />
        {/* Mensajes flotante, al lado de la campana. En el teléfono no hay header donde ponerlo y
            la barra inferior solo tiene 4 huecos, todos de uso diario; flotante queda a la vista
            sin quitarle el sitio al checador. */}
        <BotonMensajes variante="flotante" />
        <BotonReuniones variante="flotante" />
        <CampanaNotificaciones user={user} />
      </>
    );
  }
  return <HeaderNav />;
}
