import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import CapturaSelfie from "./CapturaSelfie";
import { useNotification } from "../../contexts/NotificationContext";
import { getMiRostro, registrarRostro } from "../../services/supabase/rostrosService";
import { RESULTADO, MENSAJE } from "../../utils/rostro";

const TOTAL_FOTOS = 3;

const INDICACIONES = [
  "Mira de frente a la cámara.",
  "Gira un poco la cabeza a la derecha.",
  "Gira un poco la cabeza a la izquierda.",
];

/**
 * El empleado registra su propia cara.
 *
 * Queda PENDIENTE hasta que RH la mire y confirme que es suya. Mientras tanto no sirve para
 * cotejar nada: una cara que nadie ha comprobado podría ser la del impostor, y darla por
 * buena convertiría el cotejo en un certificado de fraude.
 *
 * TRES FOTOS con ángulos distintos: una sola foto frontal falla en cuanto la persona checa
 * con la cabeza girada o con otra luz. Al cotejar se compara contra las tres y basta con
 * parecerse a una.
 */
export default function MiRostro({ user }) {
  const { toast } = useNotification();
  const camaraRef = useRef(null);

  const [rostro, setRostro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fotos, setFotos] = useState([]);
  const [consentido, setConsentido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    getMiRostro(user?.id)
      .then((r) => { if (activo) setRostro(r); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [user?.id]);

  /**
   * Guarda una foto capturada (a mano o automáticamente).
   *
   * Aquí SÍ se exige ver una cara, al revés que en el checador: si se registra una foto sin
   * cara como referencia, TODOS los cotejos futuros de esta persona fallarán y nadie
   * entenderá por qué. Un registro se puede repetir con calma; una checada de las ocho de la
   * mañana, no.
   */
  const guardarFoto = useCallback((foto) => {
    if (!foto?.blob) {
      toast.error(MENSAJE[foto?.resultado] || "No se pudo tomar la foto. Inténtalo otra vez.");
      return;
    }
    if (foto.resultado === RESULTADO.NO_DISPONIBLE) {
      toast.error("No se pudo comprobar la foto. Recarga la página e inténtalo de nuevo.");
      return;
    }
    setFotos((prev) => (prev.length >= TOTAL_FOTOS ? prev : [...prev, foto.blob]));
  }, [toast]);

  // La cámara dispara sola cuando la cara está bien encuadrada y quieta. Pedirle a alguien
  // que se encuadre Y pulse un botón, con una mano, es pedirle dos cosas a la vez — y salen
  // fotos movidas que el servidor luego rechaza.
  //
  // Una pausa entre fotos, o las tres se tomarían casi en el mismo instante y serían la
  // misma imagen: el sentido de tener tres es que sean ángulos distintos.
  const [enPausa, setEnPausa] = useState(false);

  const onAutoCaptura = useCallback((foto) => {
    if (enPausa || ocupado) return;
    guardarFoto(foto);
    setEnPausa(true);
    setTimeout(() => setEnPausa(false), 1500);
  }, [enPausa, ocupado, guardarFoto]);

  const tomarFoto = async () => {
    if (ocupado || fotos.length >= TOTAL_FOTOS) return;
    setOcupado(true);
    try {
      guardarFoto(await camaraRef.current?.capturar());
    } finally {
      setOcupado(false);
    }
  };

  const enviar = async () => {
    if (fotos.length < TOTAL_FOTOS || !consentido || ocupado) return;
    setOcupado(true);
    try {
      await registrarRostro({ empleadoId: user.id, fotos, consentimiento: true });
      setRostro({ estado: "pendiente" });
      setFotos([]);
      toast.success("Listo. Recursos Humanos revisará tus fotos.");
    } catch (e) {
      toast.error(e?.message || "No se pudo registrar tu rostro.");
    } finally {
      setOcupado(false);
    }
  };

  const estado = rostro?.estado;
  // Solo se puede (re)registrar si no hay nada, o si RH lo rechazó. Un registro ya aprobado
  // no se toca: si el empleado pudiera cambiar su cara de referencia cuando quisiera, el
  // control se evaporaría en el momento en que le conviniera.
  const puedeRegistrar = !estado || estado === "rechazado";

  if (cargando) {
    return (
      <div className="admin-page">
        <PageHeader icon="camera" title="Mi rostro" />
        <Card><p className="mc-empty">Cargando…</p></Card>
      </div>
    );
  }

  return (
    <div className="admin-page empleado-page empleado-form-narrow">
      <PageHeader
        icon="camera"
        title="Mi rostro"
        subtitle="Sirve para comprobar que eres tú quien checa"
      />

      {estado === "aprobado" && (
        <Card>
          <p className="checador-pill checador-pill--ok">
            <Icon name="check" size={16} />
            Tu rostro está registrado. No hace falta que hagas nada más.
          </p>
          <p className="mc-hint">
            <Icon name="alert" size={15} />
            Si cambió mucho tu aspecto y tus checadas empiezan a marcarse, pídele a Recursos
            Humanos que te lo vuelva a tomar.
          </p>
        </Card>
      )}

      {estado === "pendiente" && (
        <Card>
          <p className="checador-pill checador-pill--aviso">
            <Icon name="clock" size={16} />
            Tus fotos están en revisión. Recursos Humanos las confirmará.
          </p>
          <p className="mc-hint">
            <Icon name="alert" size={15} />
            Mientras tanto puedes checar con normalidad: tus checadas simplemente aún no se
            cotejarán.
          </p>
        </Card>
      )}

      {estado === "rechazado" && (
        <Card>
          <p className="checador-pill checador-pill--alerta">
            <Icon name="alert" size={16} />
            Recursos Humanos no pudo dar por buenas tus fotos.
            {rostro.motivoRechazo ? ` Motivo: ${rostro.motivoRechazo}` : ""}
          </p>
          <p className="mc-hint">
            <Icon name="alert" size={15} />
            Vuelve a tomarlas con buena luz, de frente y sin nadie más en el encuadre.
          </p>
        </Card>
      )}

      {puedeRegistrar && (
        <Card>
          <p className="mc-hint">
            <Icon name="camera" size={15} />
            Toma <strong>{TOTAL_FOTOS} fotos</strong> de tu cara. Se usarán <strong>solo</strong> para
            comprobar tus checadas de entrada y salida — nada más.
          </p>

          {fotos.length < TOTAL_FOTOS ? (
            <>
              {/* La pausa la comprueba el propio callback, no se le pasa null: si se le
                  quitara la prop, la guía de encuadre desaparecería y volvería a aparecer en
                  cada foto, y ese parpadeo hace que la cámara parezca rota. */}
              <CapturaSelfie ref={camaraRef} activa onAutoCaptura={onAutoCaptura} />

              <p className="checador-pill checador-pill--aviso">
                <Icon name="camera" size={15} />
                Foto {fotos.length + 1} de {TOTAL_FOTOS}. {INDICACIONES[fotos.length]}
              </p>

              {/* La cámara dispara sola. El botón se queda por si alguien prefiere pulsarlo,
                  o si el detector no carga y la guía nunca se activa. */}
              <button
                type="button"
                className="checador-boton checador-boton--entrada"
                onClick={tomarFoto}
                disabled={ocupado}
              >
                <Icon name="camera" size={20} />
                {ocupado ? "Tomando…" : "Tomar la foto ahora"}
              </button>
            </>
          ) : (
            <>
              <p className="checador-pill checador-pill--ok">
                <Icon name="check" size={15} />
                Ya tienes las {TOTAL_FOTOS} fotos.
              </p>

              <label className="enrolar-consentimiento">
                <input
                  type="checkbox"
                  checked={consentido}
                  onChange={(e) => setConsentido(e.target.checked)}
                />
                <span>
                  Acepto que McDental use mi rostro <strong>únicamente</strong> para comprobar mis
                  checadas de entrada y salida.
                </span>
              </label>

              <div className="enrolar-acciones">
                <button
                  type="button"
                  className="mc-btn-primary"
                  onClick={enviar}
                  disabled={!consentido || ocupado}
                >
                  {ocupado ? "Enviando…" : "Enviar para revisión"}
                </button>
                <button
                  type="button"
                  className="mc-btn-outline"
                  onClick={() => setFotos([])}
                  disabled={ocupado}
                >
                  Repetir las fotos
                </button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
