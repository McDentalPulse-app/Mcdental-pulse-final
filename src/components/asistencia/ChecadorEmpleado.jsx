import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import CapturaSelfie from "./CapturaSelfie";
import AvisoPush from "./AvisoPush";
import { useNotification } from "../../contexts/NotificationContext";
import { obtenerUbicacion, textoUbicacion } from "../../utils/geo";
import { useNavigate } from "react-router-dom";
import { getDeviceId } from "../../utils/dispositivo";
import { getMiRostro } from "../../services/supabase/rostrosService";
import { pedirReto } from "../../services/supabase/asistenciasService";
import { soportado, estadoPermiso, activar } from "../../services/pushService";
import { getAjustes } from "../../services/supabase/ajustesService";
import { RESULTADO, MENSAJE } from "../../utils/rostro";
import { emparejarChecadas, diaISO, puedeRegistrarSalida, horaSalidaAutorizada, TZ_CLINICA } from "../../utils/asistencia";

const horaCorta = (timestamp) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ_CLINICA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));

const PILL_UBICACION = {
  dentro: { icono: "mapPin", clase: "checador-pill--ok" },
  fuera: { icono: "alert", clase: "checador-pill--alerta" },
  sin_gps: { icono: "alert", clase: "checador-pill--aviso" },
  sin_geocerca: { icono: "mapPin", clase: "checador-pill--aviso" },
};

export default function ChecadorEmpleado({ user, checadasHoy = [], horarios = [], permisos = [], onChecar }) {
  const camaraRef = useRef(null);
  const { toast } = useNotification();
  const navigate = useNavigate();

  // ¿Puede checar? Si se exige rostro y no lo tiene aprobado, se le dice AQUÍ — no se le
  // deja plantarse delante de la cámara, encuadrarse y pulsar para que entonces el servidor
  // le diga que no. Enterarse de un requisito después de cumplir el trámite entero es la
  // forma más rápida de que alguien odie una herramienta.
  const [puerta, setPuerta] = useState(null); // null = cargando

  useEffect(() => {
    let activo = true;
    Promise.all([getAjustes(), getMiRostro(user?.id)])
      .then(([ajustes, rostro]) => {
        if (!activo) return;
        const vigente = rostro?.estado === "aprobado" && !rostro?.caducado;

        if (!ajustes.exigirRostro || vigente) {
          setPuerta({ abierta: true });
        } else {
          setPuerta({
            abierta: false,
            enRevision: rostro?.estado === "pendiente",
            rechazado: rostro?.estado === "rechazado",
            caducado: !!rostro?.caducado,
          });
        }
      })
      .catch(() => { if (activo) setPuerta({ abierta: true }); }); // ante la duda, no bloquear
    return () => { activo = false; };
  }, [user?.id]);
  const [enviando, setEnviando] = useState(false);
  const [ultima, setUltima] = useState(null);

  // El encuadre lo vigila la cámara. Sin esto, la gente se pega al móvil, la cara llena el
  // cuadro y sale deformada por la lente — y entonces el cotejo del servidor no reconoce a
  // su propio dueño y le bloquea la entrada. Medido: la misma persona daba 0.37 de parecido
  // consigo misma, a un pelo del umbral.
  const [encuadre, setEncuadre] = useState({ ok: true, pista: null });
  const onEncuadre = useCallback((g) => setEncuadre(g), []);

  // -------------------------------------------------------------------------
  // El reto de movimiento: girar la cabeza para demostrar que hay una cabeza y no una foto.
  // -------------------------------------------------------------------------
  //
  // Se le pregunta al SERVIDOR nada más entrar, no al pulsar: hay que saber ANTES si se van a
  // tomar una foto o dos. El servidor lo sortea (1 de cada 5) y SE LO GUARDA — así que recargar
  // la página no lo quita. Si lo quitara, esquivarlo sería tan fácil como pulsar F5.
  const [reto, setReto] = useState(null);        // "derecha" | "izquierda" | null
  const [girando, setGirando] = useState(false); // ya tiene la frontal; espera la girada
  const esperandoGiroRef = useRef(null);         // el resolve() de la promesa que espera el giro

  // La oferta de activar avisos, que aparece bajo la checada recién hecha (no un modal al entrar).
  const [ofrecerPush, setOfrecerPush] = useState(false);

  const activarAvisos = async () => {
    const r = await activar();
    setOfrecerPush(false);
    if (r === "granted") toast.success("Listo, te avisaremos aquí.");
    else if (r === "denied") toast.info("No pasa nada, puedes activarlos luego desde tu perfil.");
  };

  useEffect(() => {
    let vivo = true;
    pedirReto().then((r) => { if (vivo) setReto(r); });
    return () => { vivo = false; };
  }, []);

  /** La cámara dispara sola en cuanto ve la pose que se pidió: nadie pulsa un botón de perfil. */
  const onGiroCapturado = useCallback((foto) => {
    const resolver = esperandoGiroRef.current;
    esperandoGiroRef.current = null;
    setGirando(false);
    resolver?.(foto);
  }, []);

  /** Salida de emergencia: sin esto, quien no consiga girar se queda con el botón muerto. */
  const cancelarGiro = useCallback(() => {
    const resolver = esperandoGiroRef.current;
    esperandoGiroRef.current = null;
    setGirando(false);
    resolver?.(null);
  }, []);

  const misChecadas = useMemo(
    () => checadasHoy.filter((c) => c.empleadoId === user?.id),
    [checadasHoy, user?.id]
  );

  const { entrada, salida } = useMemo(() => emparejarChecadas(misChecadas), [misChecadas]);

  // El horario de HOY, por día ISO. La zona horaria es la de la clínica, no la del
  // navegador: si no, un móvil mal configurado le enseñaría al empleado el turno de otro
  // día.
  const horarioHoy = useMemo(() => {
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(new Date());
    const dia = diaISO(hoy);
    return horarios.find((h) => h.empleadoId === user?.id && h.diaSemana === dia) || null;
  }, [horarios, user?.id]);

  // Qué toca ahora. Si ya entró y ya salió, el día está cerrado: no se ofrece otro botón,
  // porque una tercera checada solo confundiría el registro.
  const siguiente = !entrada ? "entrada" : !salida ? "salida" : null;

  // La salida se habilita 10 min antes de la hora de su turno (migración 039). Quien
  // manda es el servidor; esto solo existe para no ofrecerle un botón que va a fallar.
  //
  // Sin esto, el botón de salida aparecería en el MISMO sitio donde acaba de pulsar el de
  // entrada: en un móvil, un doble toque le cerraba el día con una jornada de 0 minutos.
  // ¿Le autorizaron irse antes hoy? Un permiso APROBADO de salida anticipada adelanta la
  // ventana: autorizado a las 15:00, puede checar desde las 14:50. El pendiente no cuenta —
  // tratarlo como autorización convertiría "pedir permiso" en "tomárselo".
  const autorizada = useMemo(() => {
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(new Date());
    return horaSalidaAutorizada(permisos.filter((p) => p.empleadoId === user?.id), hoy);
  }, [permisos, user?.id]);

  const ventanaSalida = siguiente === "salida"
    ? puedeRegistrarSalida(horarioHoy, new Date(), autorizada, entrada?.marcadaEn)
    : { permitido: true, disponibleDesde: null };

  const bloqueado = siguiente === "salida" && !ventanaSalida.permitido;

  const handleChecar = async () => {
    if (!siguiente || enviando) return;
    setEnviando(true);

    try {
      // La foto y la ubicación se piden EN PARALELO: son dos permisos lentos del
      // navegador y encadenarlos duplicaría la espera del empleado delante del móvil.
      const [foto, coords] = await Promise.all([
        camaraRef.current?.capturar() ?? { blob: null, resultado: RESULTADO.NO_DISPONIBLE },
        obtenerUbicacion(),
      ]);

      // Sin cara (o con dos) NO se checa. Es la única comprobación que sí bloquea, y lo
      // hace porque tiene un arreglo trivial e inmediato: ponte frente a la cámara. La
      // ubicación y el propio detector, en cambio, pueden fallar por causas ajenas al
      // empleado, así que esas nunca bloquean.
      if (foto.resultado === RESULTADO.SIN_CARA || foto.resultado === RESULTADO.VARIAS_CARAS) {
        toast.error(MENSAJE[foto.resultado]);
        return;
      }

      // Le toca reto: se guarda la frontal y se espera al giro. La cámara dispara sola al ver la
      // pose, así que la persona no tiene que pulsar nada con la cabeza torcida — que es
      // imposible de hacer bien mirando de reojo.
      let retoBlob = null;
      if (reto) {
        const girada = await new Promise((resolver) => {
          esperandoGiroRef.current = resolver;
          setGirando(true);
        });

        if (!girada?.blob) {
          toast.error("No se tomó la foto girada. Inténtalo otra vez.");
          return;
        }
        retoBlob = girada.blob;
      }

      const checada = await onChecar({
        tipo: siguiente,
        coords,
        selfieBlob: foto.blob,
        retoBlob,
        deviceId: getDeviceId(),
      });
      if (!checada) return; // el toast de error ya lo emitió la acción

      setUltima(checada);

      toast.success(
        checada.tipo === "entrada"
          ? `Entrada registrada a las ${horaCorta(checada.marcadaEn)}.`
          : `Salida registrada a las ${horaCorta(checada.marcadaEn)}. ¡Buen día!`
      );

      // El momento de ofrecer los avisos es JUSTO AHORA, no al abrir la app. Un navegador al que
      // le saltas con "¿permites notificaciones?" nada más entrar recibe un "no" casi reflejo — y
      // en iOS ese "no" no se puede volver a pedir sin desinstalar. Aquí la herramienta acaba de
      // demostrar que sirve, así que la oferta tiene sentido. Solo si aún no ha decidido.
      if (soportado() && estadoPermiso() === "default") setOfrecerPush(true);
    } finally {
      setEnviando(false);
      cancelarGiro();
      // Se vuelve a preguntar: si el reto se falló, el servidor LO MANTIENE y hay que volver a
      // pedírselo. Dejar la pantalla creyendo que ya no hay reto haría que el siguiente intento
      // mandara una sola foto y volviera a fallar, esta vez sin que la persona entienda por qué.
      pedirReto().then(setReto);
    }
  };

  const pill = ultima ? PILL_UBICACION[ultima.ubicacionEstado] : null;

  if (puerta && !puerta.abierta) {
    return (
      <div className="admin-page empleado-page empleado-form-narrow">
        <PageHeader icon="clock" title="Checador" subtitle="Antes de checar, registra tu rostro" />
        <Card>
          <p className={`checador-pill ${puerta.enRevision ? "checador-pill--aviso" : "checador-pill--alerta"}`}>
            <Icon name={puerta.enRevision ? "clock" : "camera"} size={16} />
            {puerta.enRevision
              ? "Tus fotos están en revisión. Recursos Humanos debe aprobarlas antes de que puedas checar."
              : puerta.caducado
                ? "Tus fotos caducaron (se renuevan cada 6 meses). Vuelve a tomarlas para poder checar."
                : puerta.rechazado
                  ? "Recursos Humanos no dio por buenas tus fotos. Vuelve a tomarlas."
                  : "Para poder checar, primero tienes que registrar tu rostro."}
          </p>

          {!puerta.enRevision && (
            <button
              type="button"
              className="checador-boton checador-boton--entrada"
              onClick={() => navigate("/empleado/rostro")}
            >
              <Icon name="camera" size={20} />
              {puerta.caducado ? "Renovar mis fotos" : "Registrar mi rostro"}
            </button>
          )}

          <p className="mc-hint">
            <Icon name="alert" size={15} />
            Si hoy no puedes esperar, pídele a Recursos Humanos que registre tu entrada a mano.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        icon="clock"
        title="Checador"
        subtitle={horarioHoy
          ? `Hoy trabajas de ${horarioHoy.horaEntrada.slice(0, 5)} a ${horarioHoy.horaSalida.slice(0, 5)}`
          : "Hoy no tienes turno asignado"}
      />

      <Card>
        <CapturaSelfie
          ref={camaraRef}
          activa={!!siguiente && !bloqueado}
          onEncuadre={girando ? undefined : onEncuadre}
          poseRequerida={girando ? reto : null}
          onAutoCaptura={girando ? onGiroCapturado : null}
        />

        {girando && (
          <>
            <p className="checador-pill checador-pill--aviso">
              <Icon name="camera" size={15} />
              Ahora gira despacio la cabeza hacia tu {reto === "izquierda" ? "izquierda" : "derecha"}.
              La foto se toma sola.
            </p>
            <button type="button" className="mc-btn-outline" onClick={cancelarGiro}>
              Cancelar
            </button>
          </>
        )}

        {siguiente && !girando ? (
          <>
            <button
              type="button"
              className={`checador-boton checador-boton--${siguiente}`}
              onClick={handleChecar}
              disabled={enviando || bloqueado || !encuadre.ok}
            >
              <Icon name={siguiente === "entrada" ? "check" : "logout"} size={22} />
              {enviando
                ? "Registrando…"
                : !encuadre.ok
                  ? "Colócate en el recuadro"
                  : siguiente === "entrada"
                    ? "Registrar entrada"
                    : "Registrar salida"}
            </button>

            {bloqueado && (
              // Se le dice a qué hora podrá y qué hacer si tiene que irse antes. Un "no
              // puedes" a secas acaba en una llamada a RH que nadie necesitaba.
              <p className="checador-pill checador-pill--aviso">
                <Icon name="clock" size={15} />
                {ventanaSalida.reciente
                  ? `Acabas de registrar tu entrada. Podrás fichar la salida a partir de las ${ventanaSalida.disponibleDesde}.`
                  : ventanaSalida.autorizada
                    ? `Tu salida está autorizada para las ${ventanaSalida.horaAutorizada}. Podrás checar a partir de las ${ventanaSalida.disponibleDesde}.`
                    : `Podrás registrar tu salida a partir de las ${ventanaSalida.disponibleDesde}. Si necesitas irte antes, pide un permiso de salida anticipada a Recursos Humanos.`}
              </p>
            )}

            {/* Autorizado y ya dentro de la ventana: se le confirma, para que no dude de si
                el permiso llegó a aprobarse. */}
            {!bloqueado && siguiente === "salida" && ventanaSalida.autorizada && (
              <p className="checador-pill checador-pill--ok">
                <Icon name="check" size={15} />
                Recursos Humanos autorizó tu salida a las {ventanaSalida.horaAutorizada}.
              </p>
            )}
          </>
        ) : (
          <div className="checador-cerrado">
            <Icon name="check" size={22} />
            <p>Ya registraste tu entrada y tu salida de hoy.</p>
          </div>
        )}

        {ultima && (
          <p className={`checador-pill ${pill?.clase || ""}`}>
            <Icon name={pill?.icono || "mapPin"} size={15} />
            {textoUbicacion(ultima.ubicacionEstado, ultima.distanciaM, user?.sucursal)}
          </p>
        )}
      </Card>

      {ofrecerPush && (
        <AvisoPush onActivar={activarAvisos} onCerrar={() => setOfrecerPush(false)} />
      )}

      <SectionTitle icon="history">Tus checadas de hoy</SectionTitle>
      <Card>
        {misChecadas.length === 0 ? (
          <p className="mc-empty">Todavía no has checado hoy.</p>
        ) : (
          <ul className="checador-lista">
            {misChecadas.map((c) => (
              <li key={c.id} className={c.anulada ? "checador-lista-item--anulada" : ""}>
                <Icon name={c.tipo === "entrada" ? "check" : "logout"} size={16} />
                <strong>{c.tipo === "entrada" ? "Entrada" : "Salida"}</strong>
                <span>{horaCorta(c.marcadaEn)}</span>
                {c.anulada && <em>Anulada por RH</em>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
