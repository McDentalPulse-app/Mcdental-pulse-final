import React, { useMemo, useState } from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import CalendarioMensual from "../common/CalendarioMensual";

const hoyIso = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
const legible = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

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
  // Solo los días NO laborables se pueden ceder en un intercambio.
  const festivosFuturos = useMemo(
    () => festivos.filter((f) => f.fecha >= hoy && esNoLaborable(f)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [festivos, hoy],
  );

  const [festivoSel, setFestivoSel] = useState("");
  const [destino, setDestino] = useState("");
  const [enviando, setEnviando] = useState(false);

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
        <CalendarioMensual eventos={eventos} />
      </Card>

      <Card>
        <SectionTitle icon="calendar">Intercambiar un día</SectionTitle>
        <p className="intercambio-hint">
          Elige el día festivo que quieres trabajar y a cambio pide el día que prefieras libre.
          Cada día destino lo puede tomar una sola persona.
        </p>

        <div className="mc-form-group">
          <label className="mc-form-label" htmlFor="ic-festivo">Festivo que cedo (trabajo ese día)</label>
          <select id="ic-festivo" className="mc-form-select" value={festivoSel} onChange={(e) => setFestivoSel(e.target.value)}>
            <option value="">Selecciona un festivo…</option>
            {festivosFuturos.map((f) => (
              <option key={f.id} value={f.fecha}>{legible(f.fecha)} — {f.nombre}</option>
            ))}
          </select>
        </div>

        <div className="mc-form-group">
          <label className="mc-form-label" htmlFor="ic-destino">Día que quiero a cambio</label>
          <input
            id="ic-destino"
            type="date"
            className="mc-form-input"
            min={hoy}
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
          />
          {ocupado && <span className="intercambio-error">Ese día ya está apartado por otra persona.</span>}
          {destinoEsFestivo && <span className="intercambio-error">No puedes pedir un día que ya es festivo.</span>}
        </div>

        <button type="button" className="mc-btn-primary" onClick={enviar} disabled={!puedeEnviar}>
          <Icon name="check" size={15} /> {enviando ? "Enviando…" : "Solicitar intercambio"}
        </button>
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
