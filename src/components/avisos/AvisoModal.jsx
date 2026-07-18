import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { sucursalMatches } from "../../utils/constants";

const SEGUNDOS_ESPERA = 30;

/**
 * El cuerpo del modal para UN aviso. Vive aparte y se monta con key={aviso.id} desde
 * AvisoModal: así, cuando cambia el aviso, React lo desmonta y remonta entero en vez de
 * reutilizar la instancia — el contador nace en 30 por el useState inicial, sin tener
 * que resetearlo a mano dentro de un efecto (que dispararía un render extra de más,
 * lo marca react-hooks/set-state-in-effect).
 */
const ContenidoAviso = ({ aviso, onAceptar }) => {
  const [segundos, setSegundos] = useState(SEGUNDOS_ESPERA);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setSegundos((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const aceptar = async () => {
    setEnviando(true);
    await onAceptar(aviso.id);
    setEnviando(false);
    // Si falla, el modal se queda tal cual: reintentar es simplemente volver a pulsar.
  };

  return (
    <div
      className="mc-modal mc-notify-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-modal-title"
    >
      <div className="mc-notify-modal-icon mc-notify-modal-icon--info">
        <Icon name="bell" size={22} />
      </div>
      <h2 id="aviso-modal-title" className="mc-notify-modal-title">{aviso.titulo}</h2>
      <p className="mc-notify-modal-desc aviso-modal-cuerpo">{aviso.cuerpo}</p>
      {aviso.autor && <p className="aviso-modal-autor">— {aviso.autor}</p>}
      <div className="mc-notify-modal-actions">
        <button
          type="button"
          className="mc-btn-primary mc-btn-with-icon"
          onClick={aceptar}
          disabled={segundos > 0 || enviando}
        >
          <Icon name="check" size={16} />
          {segundos > 0 ? `De acuerdo (${segundos})` : "De acuerdo"}
        </button>
      </div>
    </div>
  );
};

/**
 * El modal bloqueante de avisos: uno a la vez, del más viejo al más nuevo (el orden en
 * que se publicaron), sin botón de cancelar y sin cerrar con click-afuera ni Escape —
 * a propósito. Es un aviso obligatorio, no una sugerencia: si se pudiera saltar, nadie
 * lo leería y la función entera sería teatro.
 *
 * Los 30 segundos son el tiempo mínimo antes de que "De acuerdo" se pueda pulsar. No
 * garantizan que alguien LEYÓ el aviso, pero si algo importante cabe en 30 segundos de
 * pantalla, es más probable que se lea que si el botón está listo desde el segundo cero.
 */
const AvisoModal = ({ avisos = [], avisosLeidos = [], onMarcarLeido, sucursalUsuario, usuarioId }) => {
  const pendientes = useMemo(() => {
    const leidosIds = new Set(avisosLeidos.map((l) => l.avisoId));
    return avisos
      .filter((a) => !leidosIds.has(a.id))
      // No bloquear a quien PUBLICÓ el aviso: ya lo conoce (igual que el trigger 065 no le
      // manda notificación de su propio aviso). Evita que un admin quede preso de su comunicado.
      .filter((a) => a.creadoPor !== usuarioId)
      // Solo bloquea con avisos dirigidos a la sucursal de quien mira. Para un empleado
      // RLS ya filtró (solo llegan los suyos); para la gestión NO (ve todos en el
      // historial), así que sin este filtro un admin quedaría preso de cada aviso local.
      .filter((a) => (a.sucursales || []).some((s) => sucursalMatches(s, sucursalUsuario)))
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [avisos, avisosLeidos, sucursalUsuario, usuarioId]);

  const actual = pendientes[0] || null;
  if (!actual) return null;

  return (
    <div className="mc-modal-overlay mc-notify-overlay" role="presentation">
      <ContenidoAviso key={actual.id} aviso={actual} onAceptar={onMarcarLeido} />
    </div>
  );
};

export default AvisoModal;
