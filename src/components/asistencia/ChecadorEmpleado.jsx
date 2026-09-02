import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import CapturaSelfie from "./CapturaSelfie";
import ModalChecada from "./ModalChecada";
import AvisoPush from "./AvisoPush";
import { useNotification } from "../../contexts/NotificationContext";
import { obtenerUbicacion, textoUbicacion, evaluarUbicacion, evaluarUbicacionEnVarias, textoCandado } from "../../utils/geo";
import { useNavigate } from "react-router-dom";
import { rutaBaseDe } from "../../config/navItems";
import { getDeviceId } from "../../utils/dispositivo";
import { marcarChecadaEnCurso } from "../../utils/actualizacion";
import { getMiRostro } from "../../services/supabase/rostrosService";
import { getSucursales } from "../../services/supabase/sucursalesService";
import { pedirReto } from "../../services/supabase/asistenciasService";
import { soportado, estadoPermiso, activar } from "../../services/pushService";
import { getAjustes } from "../../services/supabase/ajustesService";
import { RESULTADO, MENSAJE } from "../../utils/rostro";
import { emparejarChecadas, diaISO, puedeRegistrarSalida, horaSalidaAutorizada, minutosRetardo, TZ_CLINICA } from "../../utils/asistencia";
import { useVoz, construirFraseChecada } from "../../utils/voz";
import { esPeriodoActual } from "../../utils/constants";

const horaCorta = (timestamp, tz = TZ_CLINICA) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));

/** "YYYY-MM-DD" de hoy en la zona de SU clínica. */
const hoyEn = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

const PILL_UBICACION = {
  dentro: { icono: "mapPin", clase: "checador-pill--ok" },
  fuera: { icono: "alert", clase: "checador-pill--alerta" },
  sin_gps: { icono: "alert", clase: "checador-pill--aviso" },
  sin_geocerca: { icono: "mapPin", clase: "checador-pill--aviso" },
};

export default function ChecadorEmpleado({ user, checadasHoy = [], horarios = [], permisos = [], encuestas = [], onChecar }) {
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

  // -------------------------------------------------------------------------
  // Candado de geocerca EN VIVO: no se le deja fichar desde fuera del área.
  // -------------------------------------------------------------------------
  //
  // El servidor es la ley (api/checar.js rechaza igual), pero avisar acá evita que la persona
  // haga todo el baile de selfie/reto para rebotar al final. `undefined` = todavía cargando la
  // sucursal (se trata como "buscando ubicación", botón bloqueado); `null` = la clínica no tiene
  // geocerca configurada (no bloquea, es un olvido de admin, no del empleado).
  const [sucursal, setSucursal] = useState(undefined);
  const [ubicacion, setUbicacion] = useState(null); // último fix del GPS

  // Quien apoya en otras clínicas puede fichar dentro del área de CUALQUIERA de ellas
  // (permiso `puede_marcar_en_cualquier_clinica`, migración 118). Solo para esas personas se
  // guarda la lista completa; para el resto queda vacía y nadie la mira.
  const enCualquierClinica = !!user?.puedeMarcarEnCualquierClinica;
  const [clinicas, setClinicas] = useState([]);

  useEffect(() => {
    let vivo = true;
    getSucursales()
      .then((lista) => {
        if (!vivo) return;
        setSucursal(lista.find((s) => s.nombre === user?.sucursal) ?? null);
        setClinicas(lista.filter((s) => s.activa !== false));
      })
      .catch(() => { if (vivo) { setSucursal(null); setClinicas([]); } }); // ante la duda, no bloquear por geocerca
    return () => { vivo = false; };
  }, [user?.sucursal]);

  // watchPosition (no una sola lectura): el estado se auto-corrige a medida que el GPS se
  // asienta, y el botón se habilita solo en cuanto la persona entra al área — sin pelearse con
  // un botón de "volver a comprobar".
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setUbicacion({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
        }),
      (error) => {
        console.warn("watchPosition falló:", error?.message || error);
        setUbicacion(null); // sin ubicación => sin_gps => botón bloqueado (GPS denegado no ficha)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // La zona horaria de SU clínica. Mientras la sucursal carga (o si no se pudo resolver) se usa
  // la del centro, que es la correcta para 23 de las 26. Todo lo que compara una hora del turno
  // contra una checada tiene que pasar por aquí: es lo que le apuntaba 55 minutos de retardo a
  // quien en Hermosillo llegaba puntual.
  const tz = sucursal?.zonaHoraria || TZ_CLINICA;

  const misChecadas = useMemo(
    () => checadasHoy.filter((c) => c.empleadoId === user?.id),
    [checadasHoy, user?.id]
  );

  const { entrada, salida } = useMemo(() => emparejarChecadas(misChecadas), [misChecadas]);

  // Qué toca ahora. Si ya entró y ya salió, el día está cerrado: no se ofrece otro botón,
  // porque una tercera checada solo confundiría el registro. Se calcula ANTES del candado
  // porque el candado necesita saber si lo que sigue es la salida (permiso 127).
  const siguiente = !entrada ? "entrada" : !salida ? "salida" : null;

  // Salida sin geocerca (permiso `puede_marcar_salida_sin_geocerca`, migración 127): solo
  // afecta la salida, nunca la entrada. Con el permiso y tocando salida, no se evalúa GPS en
  // absoluto — el servidor hace exactamente lo mismo en `sucursal_para_checada`.
  const salidaLibre = siguiente === "salida" && !!user?.puedeMarcarSalidaSinGeocerca;

  // Entrada libre (permiso `puede_marcar_entrada_libre`, migración 135): a diferencia de
  // salida, el permiso NO basta por sí solo — hace falta que la persona prenda el
  // interruptor para ESTA checada. Se apaga a mano justo después de registrar (en
  // handleChecar), no con un efecto: para cuando `siguiente` pase a "salida" ya no
  // importa (puedeEntradaLibre lo tapa), pero apagarlo evita que se quede prendido por
  // si el día se cierra y se vuelve a abrir sin recargar la página.
  const puedeEntradaLibre = siguiente === "entrada" && !!user?.puedeMarcarEntradaLibre;
  const [entradaLibre, setEntradaLibre] = useState(false);

  const candado = useMemo(() => {
    if (salidaLibre) return { estado: "dentro", distanciaM: null };
    if (puedeEntradaLibre && entradaLibre) return { estado: "dentro", distanciaM: null };
    // sucursal aún cargando: se fuerza "sin_gps" para que el botón espere y muestre "buscando".
    if (sucursal === undefined) return { estado: "sin_gps", distanciaM: null };
    return enCualquierClinica
      ? evaluarUbicacionEnVarias(ubicacion, clinicas)
      : evaluarUbicacion(ubicacion, sucursal);
  }, [ubicacion, sucursal, clinicas, enCualquierClinica, salidaLibre, puedeEntradaLibre, entradaLibre]);

  const fueraDeArea = candado.estado === "fuera" || candado.estado === "sin_gps";

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

  // La cámara NO se abre al entrar a la pantalla: solo cuando la persona pulsa "Registrar
  // entrada/salida". Así no hay una cámara encendida "por si acaso" mientras nadie va a checar.
  const [capturando, setCapturando] = useState(false);

  // Mientras se está checando, el aviso obligatorio de versión nueva espera su turno: un overlay
  // encima de la cámara dejaría a la persona sin poder marcar. Se libera al cerrar la cámara y
  // también al salir de la pantalla, que es lo que hace el cleanup — si no, un aviso pendiente
  // se quedaría bloqueado para siempre por una checada que ya no existe.
  useEffect(() => {
    marcarChecadaEnCurso(capturando || enviando);
    return () => marcarChecadaEnCurso(false);
  }, [capturando, enviando]);

  // Narración por voz: guía a quien no mira la pantalla mientras se encuadra, y confirma la
  // checada en voz alta. Encendida por defecto; la preferencia se recuerda. El checador es el
  // dispositivo personal de cada quien (no un kiosco compartido), así que la voz no molesta a nadie.
  const [voz, setVoz] = useState(() => localStorage.getItem("mc-checador-voz") !== "off");
  const { hablar, callar, disponible: vozDisponible } = useVoz(voz);
  const alternarVoz = () =>
    setVoz((v) => {
      const nueva = !v;
      localStorage.setItem("mc-checador-voz", nueva ? "on" : "off");
      if (!nueva) callar();
      return nueva;
    });

  // La confirmación en medio de la pantalla. Antes esto era solo un toast, y con el recuadro de
  // la cámara quedándose en negro detrás, la gente no sabía si había fichado.
  const [confirmacion, setConfirmacion] = useState(null); // { tipo, hora, tarde, fuera }

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

  // Al arrancar el reto anti-foto, la voz da la orden una vez ("gira despacio la cabeza…"); a
  // partir de ahí, las correcciones finas ("un poco más", "es el otro lado") las va diciendo la
  // cámara con sus propias pistas de pose. Se dispara al pasar a `girando`, no en cada render.
  useEffect(() => {
    if (girando && reto) {
      hablar(`Ahora gira despacio la cabeza hacia tu ${reto === "izquierda" ? "izquierda" : "derecha"}.`, { repetir: true });
    }
  }, [girando, reto, hablar]);

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

  // El horario de HOY, por día ISO. La zona horaria es la de la clínica, no la del
  // navegador: si no, un móvil mal configurado le enseñaría al empleado el turno de otro
  // día.
  const horarioHoy = useMemo(() => {
    const hoy = hoyEn(tz);
    const dia = diaISO(hoy);
    return horarios.find((h) => h.empleadoId === user?.id && h.diaSemana === dia) || null;
  }, [horarios, user?.id, tz]);

  // La salida se habilita 10 min antes de la hora de su turno (migración 039). Quien
  // manda es el servidor; esto solo existe para no ofrecerle un botón que va a fallar.
  //
  // Sin esto, el botón de salida aparecería en el MISMO sitio donde acaba de pulsar el de
  // entrada: en un móvil, un doble toque le cerraba el día con una jornada de 0 minutos.
  // ¿Le autorizaron irse antes hoy? Un permiso APROBADO de salida anticipada adelanta la
  // ventana: autorizado a las 15:00, puede checar desde las 14:50. El pendiente no cuenta —
  // tratarlo como autorización convertiría "pedir permiso" en "tomárselo".
  const autorizada = useMemo(() => {
    const hoy = hoyEn(tz);
    return horaSalidaAutorizada(permisos.filter((p) => p.empleadoId === user?.id), hoy);
  }, [permisos, user?.id, tz]);

  const ventanaSalida = siguiente === "salida"
    ? puedeRegistrarSalida(horarioHoy, new Date(), autorizada, entrada?.marcadaEn, tz)
    : { permitido: true, disponibleDesde: null };

  const bloqueado = siguiente === "salida" && !ventanaSalida.permitido;

  // Viernes sin encuesta semanal contestada: no se deja marcar entrada hasta que la conteste
  // (la salida no se toca). El servidor es quien de verdad bloquea (registrar_checada,
  // migración 128); esto solo evita el trámite de foto/ubicación para enterarse al final.
  const encuestaPendiente = useMemo(() => {
    if (siguiente !== "entrada") return false;
    const hoy = hoyEn(tz);
    const esViernes = diaISO(hoy) === 5;
    if (!esViernes) return false;
    return !encuestas.some((e) => e.empleadoId === user?.id && esPeriodoActual(e.semana));
  }, [siguiente, encuestas, user?.id, tz]);

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
        hablar(MENSAJE[foto.resultado], { repetir: true });
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
          hablar("No se tomó la foto girada. Inténtalo otra vez.", { repetir: true });
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
        entradaLibre: puedeEntradaLibre && entradaLibre,
      });
      if (!checada) return; // el toast de error ya lo emitió la acción

      setUltima(checada);
      setEntradaLibre(false); // se apaga tras usarse, no se queda prendido para la próxima

      // ¿La entrada llegó tarde? La tolerancia decide SI es retardo; se compara igual que el
      // resto de la app (minutosRetardo vs toleranciaMin del horario). La salida nunca es retardo.
      const hora = horaCorta(checada.marcadaEn, tz);
      const tolerancia = Number.isFinite(horarioHoy?.toleranciaMin) ? horarioHoy.toleranciaMin : 0;
      const tarde =
        checada.tipo === "entrada" && minutosRetardo({ marcadaEn: checada.marcadaEn }, horarioHoy, tz) > tolerancia;
      const fuera = checada.ubicacionEstado === "fuera";

      // La cámara se cierra AQUÍ, antes de confirmar nada, y no solo en el `finally`. Así el
      // recuadro desaparece y el bucle de guía se para en el mismo instante en que aparece la
      // confirmación, en vez de quedarse hablando por debajo.
      setCapturando(false);

      // Y se calla lo que estuviera sonando antes de decir la confirmación: la guía va soltando
      // pistas cada 350 ms ("acércate", "centra tu cara") y sin este corte la confirmación
      // entraba en la cola detrás de ellas — se oía tarde, o pisada.
      callar();

      toast.success(
        checada.tipo === "entrada"
          ? `Entrada registrada a las ${hora}${tarde ? ", con retardo" : ""}.`
          : `Salida registrada a las ${hora}. ¡Buen día!`
      );
      setConfirmacion({ tipo: checada.tipo, hora, tarde, fuera });
      hablar(construirFraseChecada(checada.tipo, hora, { tarde, fuera }), { repetir: true });

      // El momento de ofrecer los avisos es JUSTO AHORA, no al abrir la app. Un navegador al que
      // le saltas con "¿permites notificaciones?" nada más entrar recibe un "no" casi reflejo — y
      // en iOS ese "no" no se puede volver a pedir sin desinstalar. Aquí la herramienta acaba de
      // demostrar que sirve, así que la oferta tiene sentido. Solo si aún no ha decidido.
      if (soportado() && estadoPermiso() === "default") setOfrecerPush(true);
    } finally {
      setEnviando(false);
      cancelarGiro();
      setCapturando(false); // se cierra la cámara: para la siguiente checada hay que volver a abrirla
      // Se vuelve a preguntar: si el reto se falló, el servidor LO MANTIENE y hay que volver a
      // pedírselo. Dejar la pantalla creyendo que ya no hay reto haría que el siguiente intento
      // mandara una sola foto y volviera a fallar, esta vez sin que la persona entienda por qué.
      pedirReto().then(setReto);
    }
  };

  const pill = ultima ? PILL_UBICACION[ultima.ubicacionEstado] : null;

  // La clínica que confirma la checada es la que quedó GUARDADA en ella, no la asignada: quien
  // apoya en otra sucursal (mig. 118) fichó ahí, y decirle "Ubicación confirmada · <su clínica>"
  // sería nombrarle un sitio en el que no está. Sin coincidencia se cae a la suya, que es lo que
  // se enseñaba antes de esto.
  const clinicaDeLaUltima =
    clinicas.find((s) => s.id === ultima?.sucursalId)?.nombre ?? user?.sucursal;

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
              onClick={() => navigate(`/${rutaBaseDe(user?.role)}/rostro`)}
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
      >
        {vozDisponible && (
          <button
            type="button"
            className={`checador-voz-btn${voz ? " checador-voz-btn--on" : ""}`}
            onClick={alternarVoz}
            aria-pressed={voz}
            title={voz ? "Silenciar la voz guía" : "Activar la voz guía"}
          >
            <Icon name={voz ? "volumen" : "volumenOff"} size={18} />
            <span>{voz ? "Voz activada" : "Voz silenciada"}</span>
          </button>
        )}
      </PageHeader>

      <Card>
        {/* La cámara se MONTA solo mientras se está checando, no siempre.
            Antes vivía aquí permanentemente: al entrar a la pantalla, sin haber pulsado nada,
            se veía un recuadro que decía "Abriendo la cámara…" para siempre (no había ninguna
            cámara abriéndose), y al terminar de checar ese mismo recuadro se quedaba en negro.
            Montándola solo cuando toca, las dos cosas desaparecen y además no queda ni un
            bucle de detección corriendo cuando nadie está fichando. */}
        {capturando && (
          <CapturaSelfie
            ref={camaraRef}
            activa={!bloqueado}
            onEncuadre={girando ? undefined : onEncuadre}
            poseRequerida={girando ? reto : null}
            onAutoCaptura={girando ? onGiroCapturado : null}
            hablar={voz ? hablar : null}
          />
        )}

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

        {puedeEntradaLibre && !capturando && !girando && (
          <label className="checador-entrada-libre">
            <input
              type="checkbox"
              checked={entradaLibre}
              onChange={(e) => setEntradaLibre(e.target.checked)}
            />
            <span>Marcar entrada sin retardo</span>
          </label>
        )}

        {siguiente && !girando ? (
          <>
            {!capturando ? (
              // Paso 1: la cámara está apagada. Este botón la abre (no captura todavía).
              <button
                type="button"
                className={`checador-boton checador-boton--${siguiente}`}
                onClick={() => setCapturando(true)}
                disabled={bloqueado || fueraDeArea || encuestaPendiente}
              >
                <Icon name={siguiente === "entrada" ? "check" : "logout"} size={22} />
                {fueraDeArea
                  ? candado.estado === "sin_gps"
                    ? "Buscando tu ubicación…"
                    : "Estás fuera del área"
                  : siguiente === "entrada"
                    ? "Registrar entrada"
                    : "Registrar salida"}
              </button>
            ) : (
              // Paso 2: la cámara ya está abierta. Este botón toma la foto y registra.
              <>
                <button
                  type="button"
                  className={`checador-boton checador-boton--${siguiente}`}
                  onClick={handleChecar}
                  disabled={enviando || !encuadre.ok}
                >
                  <Icon name="camera" size={22} />
                  {enviando
                    ? "Registrando…"
                    : !encuadre.ok
                      ? "Colócate en el recuadro"
                      : "Tomar foto y registrar"}
                </button>
                <button
                  type="button"
                  className="mc-btn-outline"
                  onClick={() => setCapturando(false)}
                  disabled={enviando}
                >
                  Cancelar
                </button>
              </>
            )}

            {fueraDeArea && (
              // El candado del cliente. El servidor rechaza igual; esto solo evita el baile de
              // selfie/reto para rebotar al final. Se auto-actualiza con cada fix del GPS.
              <p className={`checador-pill ${candado.estado === "fuera" ? "checador-pill--alerta" : "checador-pill--aviso"}`}>
                <Icon name={candado.estado === "fuera" ? "alert" : "mapPin"} size={15} />
                {textoCandado(
                  candado.estado,
                  candado.distanciaM,
                  // A quien puede fichar en cualquier clínica no se le manda a la suya: la
                  // distancia que ve es a la más cercana, y ahí es donde tiene que acercarse.
                  enCualquierClinica ? "una clínica McDental" : user?.sucursal
                )}
              </p>
            )}

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

            {encuestaPendiente && (
              <>
                <p className="checador-pill checador-pill--aviso">
                  <Icon name="clipboardCheck" size={15} />
                  Antes de marcar tu entrada hoy (es viernes), contesta la encuesta semanal.
                </p>
                <button type="button" className="mc-btn-outline" onClick={() => navigate(`/${rutaBaseDe(user?.role)}/encuesta`)}>
                  Contestar encuesta
                </button>
              </>
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
            {textoUbicacion(ultima.ubicacionEstado, ultima.distanciaM, clinicaDeLaUltima)}
          </p>
        )}
      </Card>

      {confirmacion && (
        <ModalChecada {...confirmacion} onCerrar={() => setConfirmacion(null)} />
      )}

      {/* La oferta de avisos espera a que se cierre la confirmación: dos ventanas encima de la
          otra a las ocho de la mañana es una de más, y la que importa es la de la checada. */}
      {ofrecerPush && !confirmacion && (
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
                <span>{horaCorta(c.marcadaEn, tz)}</span>
                {c.anulada && <em>Anulada por RH</em>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
