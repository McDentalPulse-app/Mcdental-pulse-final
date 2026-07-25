import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import HtmlSeguro from "../common/HtmlSeguro";
import { etiquetaRol, sucursalMatches } from "../../utils/constants";
import { getAjustes, AVISOS_SEGUNDOS_DEFECTO } from "../../services/supabase/ajustesService";

/**
 * El cuerpo del modal para UN aviso. Vive aparte y se monta con key={aviso.id} desde
 * AvisoModal: así, cuando cambia el aviso, React lo desmonta y remonta entero en vez de
 * reutilizar la instancia — el contador nace en el valor configurado por el useState
 * inicial, sin tener que resetearlo a mano dentro de un efecto (que dispararía un render
 * extra de más, lo marca react-hooks/set-state-in-effect).
 */
const ContenidoAviso = ({ aviso, segundosEspera, onAceptar }) => {
  const [segundos, setSegundos] = useState(segundosEspera);
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

  const rol = etiquetaRol(aviso.autorRol);

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
      <HtmlSeguro className="mc-notify-modal-desc aviso-modal-cuerpo aviso-html" html={aviso.cuerpo} />
      {aviso.autor && (
        <p className="aviso-modal-autor">
          <span>— {aviso.autor}{rol ? ` · ${rol}` : ""}</span>
        </p>
      )}
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
 * La espera antes de poder pulsar "De acuerdo" es el ajuste global `avisos_segundos`
 * (migración 084, 30 s de fábrica), no una constante compilada. No garantiza que alguien
 * LEYÓ el aviso, pero si algo importante permanece ese rato en pantalla, es más probable
 * que se lea que si el botón está listo desde el segundo cero.
 */
const AvisoModal = ({ avisos = [], avisosLeidos = [], onMarcarLeido, sucursalUsuario, usuarioId }) => {
  const [segundosEspera, setSegundosEspera] = useState(null);

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
  const hayPendiente = !!actual;

  // La espera se consulta una sola vez, y solo si de verdad hay algo que mostrar: a quien no
  // tiene avisos pendientes (la mayoría, casi siempre) no le cuesta ni una petición.
  useEffect(() => {
    if (!hayPendiente || segundosEspera !== null) return undefined;
    let activo = true;
    getAjustes()
      .then((a) => { if (activo) setSegundosEspera(a.avisosSegundos ?? AVISOS_SEGUNDOS_DEFECTO); })
      .catch(() => { if (activo) setSegundosEspera(AVISOS_SEGUNDOS_DEFECTO); });
    return () => { activo = false; };
  }, [hayPendiente, segundosEspera]);

  // No se dibuja hasta saber cuántos segundos son: si arrancara con el valor de fábrica y
  // llegara otro, habría que reiniciar el contador a mitad de cuenta.
  if (!actual || segundosEspera === null) return null;

  return (
    <div className="mc-modal-overlay mc-notify-overlay" role="presentation">
      <ContenidoAviso
        key={actual.id}
        aviso={actual}
        segundosEspera={segundosEspera}
        onAceptar={onMarcarLeido}
      />
    </div>
  );
};

export default AvisoModal;
