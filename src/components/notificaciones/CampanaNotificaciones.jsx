import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../ui/Icon";
import {
  getNotificaciones,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  subscribeNotificaciones,
} from "../../services/supabase/notificacionesService";

// Ícono por tipo: da de un vistazo QUÉ es la notificación sin leer el título.
const ICONO_TIPO = {
  rostro: "camera",
  permiso: "calendar",
  vacacion: "vacation",
  mensaje: "message",
  checada: "shieldAlert",
  encuesta: "clipboard",
  ticket: "wrench",
  confidencial: "lock",
  aviso: "bell",
};

const tiempoRelativo = (iso) => {
  const seg = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return "ahora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const dias = Math.floor(hrs / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
};

/**
 * La campana global. Se monta UNA vez en App.jsx (no en cada layout), fija arriba a la derecha,
 * para los 4 roles. Es la ventana a la bandeja persistente (tabla notificaciones): el usuario
 * ve aquí lo que le pasó aunque el push no llegara.
 */
export default function CampanaNotificaciones({ user }) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const cajaRef = useRef(null);

  const refrescar = useCallback(async () => {
    try {
      const [lista, cuenta] = await Promise.all([getNotificaciones(), contarNoLeidas()]);
      setItems(lista);
      setNoLeidas(cuenta);
    } catch {
      /* silencioso: una campana que falla no debe romper la app */
    }
  }, []);

  // Carga inicial + realtime: el badge sube solo cuando llega una notificación.
  useEffect(() => {
    if (!user?.id) return undefined;
    refrescar();
    return subscribeNotificaciones(user.id, refrescar);
  }, [user?.id, refrescar]);

  // Cerrar al hacer clic fuera del panel.
  useEffect(() => {
    if (!abierto) return undefined;
    const alClic = (e) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, [abierto]);

  const abrirNotificacion = async (n) => {
    setAbierto(false);
    if (!n.leida) {
      setNoLeidas((c) => Math.max(0, c - 1)); // respuesta inmediata; el realtime confirma
      marcarLeida(n.id).catch(() => {});
    }
    if (n.url && n.url !== "/") navigate(n.url);
  };

  const marcarTodas = async () => {
    setNoLeidas(0);
    setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    marcarTodasLeidas().catch(() => {});
  };

  if (!user?.id) return null;

  return (
    <div className="campana" ref={cajaRef}>
      <button
        type="button"
        className="campana-boton"
        onClick={() => setAbierto((v) => !v)}
        aria-label={noLeidas ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones"}
      >
        <Icon name="bell" size={20} />
        {noLeidas > 0 && <span className="campana-badge">{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>

      {abierto && (
        <div className="campana-panel" role="menu">
          <header className="campana-panel-head">
            <strong>Notificaciones</strong>
            {noLeidas > 0 && (
              <button type="button" className="campana-marcar" onClick={marcarTodas}>
                Marcar todas leídas
              </button>
            )}
          </header>

          {items.length === 0 ? (
            <p className="campana-vacia">
              <Icon name="inbox" size={22} />
              No tienes notificaciones.
            </p>
          ) : (
            <ul className="campana-lista">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`campana-item${n.leida ? "" : " campana-item--nueva"}`}
                    onClick={() => abrirNotificacion(n)}
                  >
                    <span className="campana-item-icono">
                      <Icon name={ICONO_TIPO[n.tipo] || "bell"} size={16} />
                    </span>
                    <span className="campana-item-texto">
                      <strong>{n.titulo}</strong>
                      {n.cuerpo && <span className="campana-item-cuerpo">{n.cuerpo}</span>}
                      <span className="campana-item-tiempo">{tiempoRelativo(n.creadaEn)}</span>
                    </span>
                    {!n.leida && <span className="campana-item-punto" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
