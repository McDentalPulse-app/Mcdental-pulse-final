import { useMemo, useState } from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import CalendarioMensual from "../common/CalendarioMensual";
import WeekSelect from "../common/WeekSelect";
import DateRangePicker from "../common/DateRangePicker";
import { diasDeAnticipacion } from "../../utils/vacaciones";
import { diasAnticipacionRequerida } from "../../utils/constants";

const hoyIso = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
const legible = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
// El desplegable de festivos vive en una columna estrecha en móvil, así que ahí la fecha va
// abreviada ("16 sep 2026") en vez del formato largo que se usa en los textos corridos.
const legibleCorto = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

const ESTADO_LABEL = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
const colorEstado = { pendiente: "azul", aprobado: "verde", rechazado: "rojo" };

/**
 * El intercambio de festivo, empotrado dentro de "Vacaciones y permisos" (PermisosEmpleado.jsx)
 * como una tercera opción de "Nueva solicitud" — antes vivía en su propio módulo del menú
 * ("Calendario"), separado de donde se piden vacaciones y permisos, y la gente no sabía que
 * ahí era donde se cambiaba un festivo. Mismo componente y misma lógica que tenía
 * CalendarioIntercambio.jsx, solo que sin su propio PageHeader: el título de la pantalla ya lo
 * pone quien lo embebe.
 */
const IntercambioFestivoPanel = ({ user, festivos, intercambios, destinosOcupados, onSolicitar }) => {
  const mios = useMemo(
    () => intercambios.filter((i) => i.empleadoId === user.id),
    [intercambios, user.id],
  );

  // Un festivo conmemorativo (Reyes, Día de Muertos…) SÍ se trabaja: no es intercambiable.
  const esNoLaborable = (f) => f.tipo !== "conmemorativo";

  const hoy = hoyIso();

  // Anticipación mínima (pedido del dueño, 2026-09-24): 30 días para toda la plantilla, 15
  // para Oficina Administrativa (utils/constants.js) — misma regla que las vacaciones.
  // Reemplaza la ventana de "este mes y el siguiente" que había antes, incluida la excepción
  // que dejaba ceder un festivo YA PASADO de este mes (para avisar que no se trabajó ese día):
  // con la anticipación exigida por igual a vacaciones y a "Cambiar festivo", un festivo que ya
  // pasó nunca puede cumplirla.
  const diasAnticipacionMin = diasAnticipacionRequerida(user?.sucursal);

  // Solo los días NO laborables se pueden ceder, y solo los que todavía cumplen la
  // anticipación mínima desde hoy. Sin tope superior a propósito: la tabla de festivos ya es
  // corta (un puñado de fechas oficiales al año), así que no hace falta acotarla a un par de
  // meses como antes.
  //
  // La lista puede quedar vacía —solo los festivos `oficial` son intercambiables, y hay tramos
  // sin ninguno cerca—, así que abajo se pinta un mensaje en lugar del formulario: un
  // desplegable vacío sin explicación acaba reportado como una falla.
  const festivosDelMes = useMemo(
    () => festivos
      .filter((f) => esNoLaborable(f) && diasDeAnticipacion(hoy, f.fecha) >= diasAnticipacionMin)
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [festivos, hoy, diasAnticipacionMin],
  );

  // <WeekSelect> no tiene opción vacía propia, así que el "sin elegir" va como primera opción.
  const opcionesFestivo = useMemo(
    () => [
      { value: "", label: "Selecciona un festivo…" },
      ...festivosDelMes.map((f) => ({ value: f.fecha, label: `${legibleCorto(f.fecha)} · ${f.nombre}` })),
    ],
    [festivosDelMes],
  );

  const [festivoSel, setFestivoSel] = useState("");
  const [destino, setDestino] = useState("");
  const [enviando, setEnviando] = useState(false);

  // El día que se pide a cambio tiene que caer en el MISMO MES que el festivo que se cede.
  // Se puede solicitar con antelación (en agosto se aparta el 16 de septiembre), pero el día
  // libre se toma dentro de septiembre: ni agosto ni octubre.
  const rangoDestino = useMemo(() => {
    if (!festivoSel) return { min: hoy, max: "" };
    const mes = festivoSel.slice(0, 7);
    const [anio, numMes] = festivoSel.split("-").map(Number);
    // Día 0 del mes SIGUIENTE = último día de este. Así no hay que saberse cuántos días tiene
    // cada mes ni acordarse de los años bisiestos.
    const ultimo = new Date(anio, numMes, 0).getDate();
    const primero = `${mes}-01`;
    return {
      min: primero > hoy ? primero : hoy, // nunca un día que ya pasó
      max: `${mes}-${String(ultimo).padStart(2, "0")}`,
    };
  }, [festivoSel, hoy]);

  // Eventos del calendario: festivos no laborables (celda resaltada) + conmemorativos (chip, se
  // trabaja) + mis intercambios (por estado).
  const eventos = [
    ...festivos.map((f) => {
      const noLaborable = esNoLaborable(f);
      return {
        fecha: f.fecha, titulo: f.nombre, etiqueta: f.nombre,
        detalle: noLaborable ? "Día no laborable" : "Conmemorativo (se trabaja)",
        color: noLaborable ? "rojo" : "verde",
        icono: noLaborable ? "partyPopper" : "star",
        esFestivo: noLaborable,
      };
    }),
    ...mios.map((i) => ({
      fecha: i.fechaDestino,
      titulo: "Mi intercambio",
      etiqueta: "Intercambio",
      icono: "refresh",
      detalle: `A cambio del ${legible(i.fechaFestivo)} · ${ESTADO_LABEL[i.estado]}`,
      color: colorEstado[i.estado] || "azul",
    })),
  ];

  const ocupado = destino && destinosOcupados.includes(destino);
  // Pedir el MISMO festivo como destino es válido: no es un cambio de día, es avisar que no
  // vienes ese día (el protocolo de la empresa para notificar la ausencia). Por eso el bloqueo
  // de "ya es festivo" no aplica cuando destino es justo el festivo que estás cediendo — solo
  // bloquea pedir un festivo NO laborable DISTINTO (eso sí no tendría sentido: ya es libre para
  // todos, no hay nada que ganar cambiándolo por otro festivo).
  const destinoEsFestivo = destino && destino !== festivoSel
    && festivos.some((f) => f.fecha === destino && esNoLaborable(f));
  const puedeEnviar = festivoSel && destino && !ocupado && !destinoEsFestivo && destino > hoy && !enviando;

  const enviar = async () => {
    if (!puedeEnviar) return;
    setEnviando(true);
    const ok = await onSolicitar({ fechaFestivo: festivoSel, fechaDestino: destino });
    setEnviando(false);
    if (ok) { setFestivoSel(""); setDestino(""); }
  };

  const pendientes = mios.filter((i) => i.estado === "pendiente").length;
  const aprobados = mios.filter((i) => i.estado === "aprobado").length;

  return (
    <>
      <div className="admin-stat-grid">
        <StatCard iconName="calendar" value={festivos.length} label="Días no laborables" valueClass="admin-stat-value--red" />
        <StatCard iconName="clock" value={pendientes} label="Mis solicitudes pendientes" valueClass="admin-stat-value--amber" />
        <StatCard iconName="check" value={aprobados} label="Mis intercambios aprobados" valueClass="admin-stat-value--green" />
      </div>

      <Card>
        <SectionTitle icon="calendar">Calendario del mes</SectionTitle>
        <CalendarioMensual
          eventos={eventos}
          festivosSeleccionables={festivosDelMes.map((f) => f.fecha)}
          onElegirFestivo={(fecha) => { setFestivoSel(fecha); setDestino(""); }}
        />
      </Card>

      <Card className="intercambio-card">
        <SectionTitle icon="calendar">Intercambiar un día</SectionTitle>
        {festivosDelMes.length === 0 ? (
          <p className="rh-data-row-muted">
            Ahora mismo no hay ningún festivo que puedas intercambiar con al menos{" "}
            {diasAnticipacionMin} días de anticipación. Vuelve a esta pantalla más cerca del
            festivo que te interese.
          </p>
        ) : (
        <>
        <p className="intercambio-hint">
          Elige el festivo y a cambio pide el día que prefieras libre — o, si solo quieres avisar
          que no vienes ese festivo sin cambiarlo por otro día, pide el mismo festivo como
          destino. Solo aparecen los festivos con al menos {diasAnticipacionMin} días de
          anticipación, y el día que pidas a cambio tiene que ser del mismo mes que el festivo.
          Cada día destino lo puede tomar una sola persona de tu clínica — salvo que pidas el
          mismo festivo, que no tiene límite.
        </p>

        <div className="mc-form-grid">
          <div className="mc-form-group">
            <label className="mc-form-label">Festivo que cedo (trabajo ese día)</label>
            <WeekSelect
              className="intercambio-festivo"
              value={festivoSel}
              options={opcionesFestivo}
              onChange={(v) => {
                setFestivoSel(v);
                // Cambiar de festivo cambia el mes permitido, así que el día elegido deja de
                // valer. Se limpia aquí, en el evento, y no en un efecto: dejarlo a la vista
                // sería ofrecer un día que el servidor va a rechazar.
                setDestino("");
              }}
            />
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label">Día que quiero a cambio</label>
            <DateRangePicker
              unico
              className="intercambio-dia"
              desde={destino}
              min={rangoDestino.min}
              max={rangoDestino.max || undefined}
              placeholder={festivoSel ? "Elige un día" : "Elige antes el festivo"}
              onChange={setDestino}
            />
            {ocupado && <span className="intercambio-error">Ese día ya está apartado por otra persona.</span>}
            {destinoEsFestivo && <span className="intercambio-error">No puedes pedir un día que ya es festivo.</span>}
          </div>

          <button type="button" className="mc-btn-primary" onClick={enviar} disabled={!puedeEnviar}>
            <Icon name="check" size={15} /> {enviando ? "Enviando…" : "Solicitar intercambio"}
          </button>
        </div>
        </>
        )}
      </Card>

      <Card>
        <SectionTitle icon="clipboardCheck">Mis intercambios de festivo</SectionTitle>
        {mios.length === 0 ? (
          <p className="rh-data-row-muted">Aún no has solicitado ningún intercambio.</p>
        ) : (
          <div className="rh-data-list">
            {mios.map((i) => (
              <div key={i.id} className="rh-data-row">
                <div className="rh-data-row-main">
                  {i.fechaFestivo === i.fechaDestino ? (
                    <div className="rh-data-row-title">No trabajaré el {legible(i.fechaFestivo)}</div>
                  ) : (
                    <>
                      <div className="rh-data-row-title">Trabajo el {legible(i.fechaFestivo)}</div>
                      <div className="rh-data-row-sub">A cambio quiero libre el {legible(i.fechaDestino)}</div>
                    </>
                  )}
                  {i.comentarioRH && <div className="rh-data-row-note">RH: {i.comentarioRH}</div>}
                </div>
                <div className="rh-data-row-status">
                  <span className={`mc-status-pill mc-status-pill--${i.estado}`}>{ESTADO_LABEL[i.estado]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
};

export default IntercambioFestivoPanel;
