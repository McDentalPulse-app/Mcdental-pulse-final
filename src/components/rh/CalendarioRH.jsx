import { useMemo } from "react";
import Card from "../common/Card";
import StatCard from "../common/StatCard";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import CalendarioMensual from "../common/CalendarioMensual";
import { normalizeSucursal } from "../../utils/constants";

const colorTipo = (tipo) => {
  if (tipo === "Vacaciones") return "aqua";
  if (tipo === "Permiso") return "ambar";
  if (tipo === "Festivo") return "rojo";
  if (tipo === "Intercambio") return "rosa";
  return "verde"; // Conmemorativo
};

const tipoPillClass = (tipo) => {
  if (tipo === "Vacaciones") return "mc-status-pill--vacaciones";
  if (tipo === "Permiso") return "mc-status-pill--permiso";
  if (tipo === "Intercambio") return "mc-status-pill--activo";
  return "mc-status-pill--festivo";
};

const legible = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

const primerNombre = (n) => (n || "").split(" ")[0];

// Ícono (SVG) por tipo — junto con el color es lo que distingue cada evento de un vistazo.
const ICONO = {
  Festivo: "partyPopper",
  Conmemorativo: "star",
  Vacaciones: "vacation",
  Permiso: "clipboardCheck",
  Intercambio: "refresh",
};

const LEYENDA = [
  { tipo: "Festivo", label: "No laborable" },
  { tipo: "Conmemorativo", label: "Conmemora." },
  { tipo: "Vacaciones", label: "Vacaciones" },
  { tipo: "Permiso", label: "Permiso" },
  { tipo: "Intercambio", label: "Intercambio" },
];

// Calendario general de RH: reúne, de datos REALES, los festivos, las vacaciones y permisos
// (aprobados o pendientes, no los rechazados) y los intercambios de día ya aprobados.
const CalendarioRH = ({ vacaciones = [], permisos = [], festivos = [], intercambios = [] }) => {
  const eventos = useMemo(() => {
    const activos = (estado) => estado !== "rechazado";
    return [
      ...festivos.map((f) => {
        const conmemorativo = f.tipo === "conmemorativo";
        return {
          id: `fes-${f.id}`,
          fecha: f.fecha,
          tipo: conmemorativo ? "Conmemorativo" : "Festivo",
          titulo: f.nombre,
          etiqueta: f.nombre,
          detalle: conmemorativo
            ? "Día conmemorativo (se trabaja)"
            : f.tipo === "empresa" ? "Día no laborable (empresa)" : "Día no laborable (oficial)",
          sucursal: null,
          // Solo los NO laborables pintan el día entero; los conmemorativos van como chip.
          esFestivo: !conmemorativo,
        };
      }),
      ...vacaciones.filter((v) => activos(v.estado)).map((v) => ({
        id: `vac-${v.id}`,
        fecha: v.fechaInicio || v.inicio,
        fechaFin: v.fechaFin || v.fin,
        tipo: "Vacaciones",
        titulo: `${v.empleado} · Vacaciones`,
        etiqueta: primerNombre(v.empleado),
        detalle: `${v.dias} días · ${v.estado}`,
        sucursal: v.sucursal,
        icon: "vacation",
      })),
      ...permisos.filter((p) => activos(p.estado)).map((p) => ({
        id: `perm-${p.id}`,
        fecha: p.fecha,
        fechaFin: p.fechaFin,
        tipo: "Permiso",
        titulo: `${p.empleado} · ${p.tipo || "Permiso"}`,
        etiqueta: primerNombre(p.empleado),
        detalle: `${p.hora || ""} · ${p.estado}`.trim(),
        sucursal: p.sucursal,
        icon: "clipboard",
      })),
      ...intercambios.filter((i) => i.estado === "aprobado").map((i) => ({
        id: `int-${i.id}`,
        fecha: i.fechaDestino,
        tipo: "Intercambio",
        titulo: `${i.empleado} · Día libre`,
        etiqueta: primerNombre(i.empleado),
        detalle: `A cambio de trabajar el ${legible(i.fechaFestivo)}`,
        sucursal: i.sucursal,
        icon: "calendar",
      })),
    ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [vacaciones, permisos, festivos, intercambios]);

  const resumen = {
    festivos: festivos.filter((f) => f.tipo !== "conmemorativo").length, // días que NO se trabaja
    vacaciones: eventos.filter((e) => e.tipo === "Vacaciones").length,
    permisos: eventos.filter((e) => e.tipo === "Permiso").length,
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="calendarDays"
        title="Calendario General"
        subtitle="Vista general de festivos, vacaciones, permisos e intercambios de día."
      />

      <div className="admin-stat-grid">
        <StatCard iconName="party" value={resumen.festivos} label="Días no laborables" valueClass="admin-stat-value--green" />
        <StatCard iconName="vacation" value={resumen.vacaciones} label="Vacaciones" valueClass="admin-stat-value--blue" />
        <StatCard iconName="clipboard" value={resumen.permisos} label="Permisos" valueClass="admin-stat-value--amber" />
      </div>

      <Card>
        <SectionTitle icon="calendarDays">Calendario</SectionTitle>

        <div className="cal-leyenda">
          {LEYENDA.map((l) => (
            <span key={l.tipo} className="cal-leyenda-item">
              <span className={`cal-leyenda-ico cal-ico--${colorTipo(l.tipo)}`} aria-hidden="true">
                <Icon name={ICONO[l.tipo]} size={14} />
              </span>
              {l.label}
            </span>
          ))}
        </div>

        <CalendarioMensual
          eventos={eventos.map((e) => ({
            fecha: e.fecha,
            fechaFin: e.fechaFin,
            titulo: e.titulo,
            etiqueta: e.etiqueta,
            icono: ICONO[e.tipo],
            esFestivo: e.esFestivo,
            detalle: e.sucursal ? normalizeSucursal(e.sucursal) : e.detalle,
            color: colorTipo(e.tipo),
          }))}
        />
      </Card>

      <Card>
        <SectionTitle icon="calendar">Agenda laboral</SectionTitle>
        {eventos.length === 0 ? (
          <p className="rh-data-row-muted">No hay eventos en el calendario.</p>
        ) : (
          <div className="rh-calendar-list">
            {eventos.map((e) => (
              <div key={e.id} className="rh-calendar-row">
                <div className="rh-calendar-date">
                  {e.fecha}
                  {e.fechaFin && e.fechaFin !== e.fecha ? (
                    <span className="rh-calendar-date-end">al {e.fechaFin}</span>
                  ) : null}
                </div>

                <div className="rh-calendar-body">
                  <div className="rh-calendar-title">
                    <Icon name={e.icon} size={16} /> {e.titulo}
                  </div>
                  <div className="rh-calendar-detail">
                    {e.sucursal ? `${normalizeSucursal(e.sucursal)} · ` : ""}{e.detalle}
                  </div>
                </div>

                <div className="rh-calendar-badge">
                  <span className={`mc-status-pill ${tipoPillClass(e.tipo)}`}>{e.tipo}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CalendarioRH;
