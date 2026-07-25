import { useCallback, useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import { soportado, instalada, estadoPermiso, activar } from "../../services/pushService";

/**
 * El empujón obligatorio para activar las notificaciones.
 *
 * POR QUÉ EXISTE: el push se ha caído varias veces porque la gente nunca llegó a activarlo, o lo
 * dejó a medias. La invitación suave (AvisoPush) se puede ignorar para siempre. Esto no: bloquea
 * la app hasta que la persona decide, y vuelve a aparecer cada sesión mientras siga sin estar
 * activo. No puede FORZAR el permiso del sistema operativo (eso lo decide iOS/Android), pero sí
 * garantiza que a nadie se le pasa la pregunta "de largo".
 *
 * LOS CASOS QUE RESPETA:
 *   · Permiso ya concedido → no aparece (todo bien; la suscripción se auto-repara sola).
 *   · iPhone sin instalar → el push NO EXISTE hasta instalar la app; se explica cómo y se deja
 *     salir (no tiene sentido bloquear algo que ahora mismo es imposible).
 *   · Permiso por decidir → bloqueante, con botón "Activar".
 *   · Permiso denegado → no se puede re-preguntar por código; se explica cómo reactivarlo a mano
 *     y se deja salir por esta sesión (vuelve a la siguiente).
 */

const DISMISS_KEY = "mcdental_forzar_push_dismiss"; // sessionStorage: se limpia al cerrar la app.

const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function ForzarNotificaciones() {
  const { toast } = useNotification();
  const [estado, setEstado] = useState(() => estadoPermiso());
  const [activando, setActivando] = useState(false);
  const [comoInstalar, setComoInstalar] = useState(false);
  const [descartado, setDescartado] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  // Si la persona sale a Ajustes del sistema y vuelve, se relee el permiso: pudo haberlo
  // concedido fuera de la app, y en ese caso el modal debe desaparecer solo.
  useEffect(() => {
    const revisar = () => setEstado(estadoPermiso());
    document.addEventListener("visibilitychange", revisar);
    window.addEventListener("focus", revisar);
    return () => {
      document.removeEventListener("visibilitychange", revisar);
      window.removeEventListener("focus", revisar);
    };
  }, []);

  const descartarSesion = useCallback(() => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDescartado(true);
  }, []);

  const onActivar = async () => {
    setActivando(true);
    try {
      const r = await activar();
      setEstado(estadoPermiso());
      if (r === "granted") toast.success("Listo, te avisaremos aquí.");
      else if (r === "denied") toast.info("Quedó bloqueado. Puedes reactivarlo desde los ajustes del teléfono.");
    } catch {
      toast.error("No se pudo activar. Inténtalo de nuevo.");
    } finally {
      setActivando(false);
    }
  };

  // Permiso concedido, o ya descartado en esta sesión: no se muestra nada.
  if (estado === "granted" || descartado) return null;

  // iPhone sin la app instalada: el push no existe todavía. Si además NO es iOS y no está
  // soportado (un navegador de escritorio viejo, p. ej.), tampoco tiene sentido bloquear.
  const iosSinInstalar = !soportado() && esIOS() && !instalada();
  if (!soportado() && !iosSinInstalar) return null;

  return (
    <div className="forzar-push-overlay" role="dialog" aria-modal="true" aria-label="Activar notificaciones">
      <div className="forzar-push-card">
        <div className="forzar-push-icon"><Icon name="bell" size={26} /></div>

        {iosSinInstalar ? (
          <>
            <h2 className="forzar-push-titulo">Activa tus notificaciones</h2>
            <p className="forzar-push-texto">
              Para recibir avisos en tu iPhone, primero agrega la app a tu pantalla de inicio.
              Es un momento:
            </p>
            {comoInstalar ? (
              <ol className="forzar-push-pasos">
                <li>Abre esta página en <strong>Safari</strong> (no en otro navegador).</li>
                <li>Toca <strong>Compartir</strong> (el cuadrito con la flecha hacia arriba).</li>
                <li>Baja y elige <strong>“Agregar a inicio”</strong>.</li>
                <li>Abre la app desde el ícono nuevo y vuelve aquí.</li>
              </ol>
            ) : (
              <button type="button" className="forzar-push-btn" onClick={() => setComoInstalar(true)}>
                Ver cómo se hace
              </button>
            )}
            <button type="button" className="forzar-push-btn forzar-push-btn--ghost" onClick={descartarSesion}>
              Ahora no
            </button>
          </>
        ) : estado === "denied" ? (
          <>
            <h2 className="forzar-push-titulo">Las notificaciones están bloqueadas</h2>
            <p className="forzar-push-texto">
              Para volver a recibir avisos, actívalas desde los ajustes de tu teléfono o navegador
              (Notificaciones → McDental Pulse → Permitir) y regresa a la app.
            </p>
            <button type="button" className="forzar-push-btn forzar-push-btn--ghost" onClick={descartarSesion}>
              Entendido
            </button>
          </>
        ) : (
          <>
            <h2 className="forzar-push-titulo">Activa tus notificaciones</h2>
            <p className="forzar-push-texto">
              Te avisamos cuando aprueben tu rostro, un permiso o haya un aviso importante — sin
              que tengas que entrar a revisar. Toma un segundo.
            </p>
            <button type="button" className="forzar-push-btn" disabled={activando} onClick={onActivar}>
              <Icon name="bell" size={16} /> {activando ? "Activando…" : "Activar notificaciones"}
            </button>
            <button type="button" className="forzar-push-btn forzar-push-btn--ghost" onClick={descartarSesion}>
              Ahora no
            </button>
          </>
        )}
      </div>
    </div>
  );
}
