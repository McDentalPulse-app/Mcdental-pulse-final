import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import CapturaSelfie from "./CapturaSelfie";
import { useNotification } from "../../contexts/NotificationContext";
import { getMiRostro, registrarRostro } from "../../services/supabase/rostrosService";
import { RESULTADO, MENSAJE, POSE } from "../../utils/rostro";

/**
 * Una pose distinta por foto, y se EXIGE.
 *
 * Sin esto, la persona se queda quieta, la cámara dispara tres veces seguidas y guarda la
 * misma cara tres veces: tener tres fotos no serviría de nada. El sentido de las tres es
 * que sean ángulos distintos — es lo que hace que el cotejo siga reconociéndola cuando
 * cheque con la cabeza un poco girada o con otra luz.
 */
const PASOS_BASE = [
  { pose: POSE.FRONTAL, indicacion: "Mira de frente a la cámara." },
  { pose: POSE.DERECHA, indicacion: "Gira la cabeza hacia tu derecha." },
  { pose: POSE.IZQUIERDA, indicacion: "Gira la cabeza hacia tu izquierda." },
];

/**
 * Si usa lentes, dos fotos más SIN ellos.
 *
 * Los lentes son la causa número uno de que el cotejo rechace a una persona honrada. Con el
 * cotejo bloqueando, ese rechazo ya no es una molestia: es alguien que no puede fichar. Se
 * guardan las dos caras —con y sin— y el cotejo se queda con el MEJOR parecido, así que lo
 * reconoce lleve o no lleve las gafas puestas ese día.
 */
const PASOS_SIN_LENTES = [
  { pose: POSE.FRONTAL, indicacion: "Ahora QUÍTATE los lentes y mira de frente." },
  { pose: POSE.DERECHA, indicacion: "Sin lentes, gira la cabeza hacia tu derecha." },
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

  // null = todavía no ha contestado. Se pregunta ANTES de empezar: si se preguntara al
  // final, quien use lentes tendría que repetir las tres fotos.
  const [usaLentes, setUsaLentes] = useState(null);

  const pasos = usaLentes ? [...PASOS_BASE, ...PASOS_SIN_LENTES] : PASOS_BASE;
  const totalFotos = pasos.length;

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
    setFotos((prev) => (prev.length >= totalFotos ? prev : [...prev, foto.blob]));
  }, [toast, totalFotos]);

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
    if (ocupado || fotos.length >= totalFotos) return;
    setOcupado(true);
    try {
      guardarFoto(await camaraRef.current?.capturar());
    } finally {
      setOcupado(false);
    }
  };

  const enviar = async () => {
    if (fotos.length < totalFotos || !consentido || ocupado) return;
    setOcupado(true);
    try {
      await registrarRostro({ empleadoId: user.id, fotos, consentimiento: true, usaLentes });
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

  // Se puede (re)registrar si no hay nada, si RH lo rechazó, o si CADUCÓ.
  //
  // Un registro aprobado y vigente no se toca: si el empleado pudiera cambiar su cara de
  // referencia cuando quisiera, el control se evaporaría en el momento en que le conviniera.
  // Pero uno caducado sí — es él quien tiene que renovarlo, y obligarle a pasar por RH para
  // algo que el sistema le está pidiendo sería fricción gratuita.
  const puedeRegistrar = !estado || estado === "rechazado" || rostro?.caducado;

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

      {estado === "aprobado" && !rostro?.caducado && (
        <Card>
          <p className="checador-pill checador-pill--ok">
            <Icon name="check" size={16} />
            Tu rostro está registrado. No hace falta que hagas nada más.
          </p>
          {/* Se le avisa con dos semanas: enterarse de que caducó el día que no puede fichar es
              enterarse tarde. */}
          {rostro?.diasParaVencer != null && rostro.diasParaVencer <= 15 && (
            <p className="checador-pill checador-pill--aviso">
              <Icon name="clock" size={15} />
              Caduca en {rostro.diasParaVencer} día(s). Vuelve a tomar tus fotos antes de que pase.
            </p>
          )}
          <p className="mc-hint">
            <Icon name="alert" size={15} />
            Se renueva cada 6 meses: la gente cambia (barba, lentes, peso) y una foto vieja
            acabaría no reconociéndote.
          </p>
        </Card>
      )}

      {estado === "aprobado" && rostro?.caducado && (
        <Card>
          <p className="checador-pill checador-pill--alerta">
            <Icon name="alert" size={16} />
            Tus fotos caducaron. Vuelve a tomarlas para poder seguir checando.
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
            Toma <strong>{totalFotos} fotos</strong> de tu cara. Se usarán <strong>solo</strong> para
            comprobar tus checadas de entrada y salida — nada más.
          </p>

          {usaLentes === null ? (
            // Se pregunta ANTES de la primera foto. Al final, quien use lentes tendría que
            // repetirlas todas.
            <div className="enrolar-lentes">
              <p><strong>¿Usas lentes?</strong></p>
              <p className="mc-hint">
                <Icon name="alert" size={15} />
                Si los usas, te pediremos también dos fotos sin ellos. Así te reconocerá los
                lleves puestos o no — y no te quedarás sin poder checar el día que te los quites.
              </p>
              <div className="enrolar-acciones">
                <button type="button" className="mc-btn-primary" onClick={() => setUsaLentes(true)}>
                  Sí, uso lentes
                </button>
                <button type="button" className="mc-btn-outline" onClick={() => setUsaLentes(false)}>
                  No uso lentes
                </button>
              </div>
            </div>
          ) : fotos.length < totalFotos ? (
            <>
              {/* La pausa la comprueba el propio callback, no se le pasa null: si se le
                  quitara la prop, la guía de encuadre desaparecería y volvería a aparecer en
                  cada foto, y ese parpadeo hace que la cámara parezca rota. */}
              <CapturaSelfie
                ref={camaraRef}
                activa
                onAutoCaptura={onAutoCaptura}
                poseRequerida={pasos[fotos.length].pose}
              />

              <p className="checador-pill checador-pill--aviso">
                <Icon name="camera" size={15} />
                Foto {fotos.length + 1} de {totalFotos}. {pasos[fotos.length].indicacion}
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
                Ya tienes las {totalFotos} fotos.
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
                  onClick={() => { setFotos([]); setUsaLentes(null); }}
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
