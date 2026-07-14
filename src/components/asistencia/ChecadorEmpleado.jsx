import { useMemo, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import CapturaSelfie from "./CapturaSelfie";
import { useNotification } from "../../contexts/NotificationContext";
import { obtenerUbicacion, textoUbicacion } from "../../utils/geo";
import { getDeviceId } from "../../utils/dispositivo";
import { RESULTADO, MENSAJE } from "../../utils/rostro";
import { emparejarChecadas, diaISO, puedeRegistrarSalida, TZ_CLINICA } from "../../utils/asistencia";

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

export default function ChecadorEmpleado({ user, checadasHoy = [], horarios = [], onChecar }) {
  const camaraRef = useRef(null);
  const { toast } = useNotification();
  const [enviando, setEnviando] = useState(false);
  const [ultima, setUltima] = useState(null);

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
  const ventanaSalida = siguiente === "salida"
    ? puedeRegistrarSalida(horarioHoy)
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

      const checada = await onChecar({
        tipo: siguiente,
        coords,
        selfieBlob: foto.blob,
        deviceId: getDeviceId(),
      });
      if (!checada) return; // el toast de error ya lo emitió la acción

      setUltima(checada);

      toast.success(
        checada.tipo === "entrada"
          ? `Entrada registrada a las ${horaCorta(checada.marcadaEn)}.`
          : `Salida registrada a las ${horaCorta(checada.marcadaEn)}. ¡Buen día!`
      );
    } finally {
      setEnviando(false);
    }
  };

  const pill = ultima ? PILL_UBICACION[ultima.ubicacionEstado] : null;

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
        <CapturaSelfie ref={camaraRef} activa={!!siguiente && !bloqueado} />

        {siguiente ? (
          <>
            <button
              type="button"
              className={`checador-boton checador-boton--${siguiente}`}
              onClick={handleChecar}
              disabled={enviando || bloqueado}
            >
              <Icon name={siguiente === "entrada" ? "check" : "logout"} size={22} />
              {enviando
                ? "Registrando…"
                : siguiente === "entrada"
                  ? "Registrar entrada"
                  : "Registrar salida"}
            </button>

            {bloqueado && (
              // Se le dice a qué hora podrá y qué hacer si tiene que irse antes. Un "no
              // puedes" a secas acaba en una llamada a RH que nadie necesitaba.
              <p className="checador-pill checador-pill--aviso">
                <Icon name="clock" size={15} />
                Podrás registrar tu salida a partir de las {ventanaSalida.disponibleDesde}.
                Si necesitas irte antes, avisa a Recursos Humanos.
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
