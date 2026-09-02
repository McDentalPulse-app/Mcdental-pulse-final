import { useMemo, useState } from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import CalendarioMensual from "../common/CalendarioMensual";
import WeekSelect from "../common/WeekSelect";
import DateRangePicker from "../common/DateRangePicker";

const hoyIso = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
const legible = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
// El desplegable de festivos vive en una columna estrecha en móvil, así que ahí la fecha va
// abreviada ("16 sep 2026") en vez del formato largo que se usa en los textos corridos.
const legibleCorto = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

const ESTADO_LABEL = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
const colorEstado = { pendiente: "azul", aprobado: "verde", rechazado: "rojo" };

// Calendario de festivos + intercambio de día, compartido por empleado y doctor. El usuario ve
// los días no laborables y puede apartar uno para cambiarlo por otro día que quiera; RH aprueba.
const CalendarioIntercambio = ({ user, festivos, intercambios, destinosOcupados, onSolicitar }) => {
  const mios = useMemo(
    () => intercambios.filter((i) => i.empleadoId === user.id),
    [intercambios, user.id],
  );

  // Un festivo conmemorativo (Reyes, Día de Muertos…) SÍ se trabaja: no es intercambiable.
  const esNoLaborable = (f) => f.tipo !== "conmemorativo";

  const hoy = hoyIso();
  const mesActual = hoy.slice(0, 7); // "YYYY-MM"

  // Un mes de anticipación: se pueden apartar los festivos de ESTE mes y los del SIGUIENTE.
  //
  // Son meses de calendario completos, NO una ventana de 30 días corridos. La diferencia no
  // es cosmética: el 4 de agosto, 30 días caen el 3 de septiembre, así que el 16 de
  // septiembre —el único festivo intercambiable del mes— quedaría fuera y en agosto no se
  // podría apartar nada. Con meses completos, desde el 1 de agosto ya se ve.
  const mesSiguiente = useMemo(() => {
    const [anio, mes] = mesActual.split("-").map(Number);
    // `mes` es 1-based y el constructor es 0-based, así que este Date YA es el mes siguiente.
    // Pasar de diciembre a enero del año próximo lo resuelve él solo.
    const d = new Date(anio, mes, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [mesActual]);

  // Solo los días NO laborables se pueden ceder. Aun con dos meses de ventana la lista puede
  // quedar vacía —solo los festivos `oficial` son intercambiables, y hay tramos sin ninguno—,
  // así que abajo se pinta un mensaje en lugar del formulario: un desplegable vacío sin
  // explicación acaba reportado como una falla.
  const festivosDelMes = useMemo(
    () => festivos
      .filter((f) => f.fecha >= hoy && esNoLaborable(f)
        && (f.fecha.startsWith(mesActual) || f.fecha.startsWith(mesSiguiente)))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [festivos, hoy, mesActual, mesSiguiente],
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
  // Solo bloquea si el destino ya es un día NO laborable (un conmemorativo sí se puede pedir).
  const destinoEsFestivo = destino && festivos.some((f) => f.fecha === destino && esNoLaborable(f));
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
    <div className="admin-page empleado-page">
      <PageHeader
        icon="calendar"
        title="Calendario"
        subtitle="Días festivos y no laborables. Puedes apartar un festivo para cambiarlo por otro día; RH lo aprueba."
      />

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
            Ahora mismo no hay ningún festivo que puedas intercambiar. Se pueden apartar con
            un mes de anticipación, así que vuelve a esta pantalla cuando se acerque el
            festivo que te interese.
          </p>
        ) : (
        <>
        <p className="intercambio-hint">
          Elige el día festivo que quieres trabajar y a cambio pide el día que prefieras libre.
          Solo aparecen los festivos de este mes y del siguiente, y el día que pidas a cambio
          tiene que ser del mismo mes que el festivo. Cada día destino lo puede tomar una sola
          persona de tu clínica.
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
        <SectionTitle icon="clipboardCheck">Mis solicitudes</SectionTitle>
        {mios.length === 0 ? (
          <p className="rh-data-row-muted">Aún no has solicitado ningún intercambio.</p>
        ) : (
          <div className="rh-data-list">
            {mios.map((i) => (
              <div key={i.id} className="rh-data-row">
                <div className="rh-data-row-main">
                  <div className="rh-data-row-title">Trabajo el {legible(i.fechaFestivo)}</div>
                  <div className="rh-data-row-sub">A cambio quiero libre el {legible(i.fechaDestino)}</div>
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
    </div>
  );
};

export default CalendarioIntercambio;
