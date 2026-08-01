import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import Card from "../common/Card";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import {
  getAsistencias,
  subscribeAsistencias,
  anularChecada,
} from "../../services/supabase/asistenciasService";
import {
  construirDias,
  agruparPor,
  resumen,
  requiereRevision,
  detectarDispositivosCompartidos,
  diaISO,
  ESTADOS_DIA,
  TZ_CLINICA,
} from "../../utils/asistencia";
import { normalizeSucursal } from "../../utils/constants";
import { useGlobal } from "../../contexts/GlobalContext";
import { descargarExcel } from "../../utils/exportarExcel";

const ETIQUETA_ESTADO = {
  [ESTADOS_DIA.PRESENTE]: "Presente",
  [ESTADOS_DIA.RETARDO]: "Retardo",
  [ESTADOS_DIA.FALTA]: "Falta",
  [ESTADOS_DIA.JUSTIFICADO]: "Justificado",
  [ESTADOS_DIA.DESCANSO]: "Descanso",
  [ESTADOS_DIA.INCOMPLETO]: "Sin salida",
  [ESTADOS_DIA.PENDIENTE]: "En curso",
};

// Leyenda de colores del calendario: qué significa cada color de celda. Cada swatch reusa la
// misma clase que pinta la celda, así el color de la leyenda y el del día son SIEMPRE el mismo.
const LEYENDA = [
  { estado: "presente", label: "Presente" },
  { estado: "retardo", label: "Retardo" },
  { estado: "falta", label: "Falta" },
  { estado: "justificado", label: "Justificado" },
  { estado: "incompleto", label: "Sin salida" },
  { estado: "descanso", label: "Descanso" },
  { estado: "pendiente", label: "En curso" },
];

const MES_ABR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const hoyClinica = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(new Date());

const horaCorta = (ts) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ_CLINICA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));

const minutosAHoras = (min) => (min ? `${Math.floor(min / 60)} h ${min % 60} min` : "—");

// Navegación mes a mes: el calendario siempre muestra un mes completo (el rango desde-hasta se
// mantiene acotado a un mes). Todo en UTC para no correr el mes por el huso del navegador.
const primerDiaDeMes = (fecha) => `${String(fecha).slice(0, 7)}-01`;
const ultimoDiaDeMes = (fecha) => {
  const [y, m] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const sumarMeses = (fecha, delta) => {
  const [y, m] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
};
const nombreMes = (fecha) => {
  const [y, m] = fecha.split("-").map(Number);
  const etiqueta = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)));
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
};

const NOMBRES_DIA_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const tituloCeldaCalendario = (d) => {
  const estado = ETIQUETA_ESTADO[d.estado] || d.estado;
  if (d.estado === ESTADOS_DIA.DESCANSO) return `${d.fecha} · Descanso`;
  const horas = d.entrada || d.salida
    ? ` · ${d.entrada ? horaCorta(d.entrada.marcadaEn) : "—"} → ${d.salida ? horaCorta(d.salida.marcadaEn) : "—"}`
    : "";
  const retardo = d.minutosRetardo > 0 ? ` (+${d.minutosRetardo} min tarde)` : "";
  return `${d.fecha} · ${estado}${horas}${retardo}`;
};

/** Un mes completo en cuadrícula (7 columnas, Lun-Dom). Cada celda se colorea por el estado del
 * día; clic en un día con checada lo anula, clic en una falta la justifica. Muestra la hora de
 * entrada/salida cuando la hay, y un punto si esa checada quedó marcada para revisión. */
const CalendarioMes = ({ dias, mesInicio, puedeAnular, onAnularDia, puedeJustificar, onJustificarDia, revisarIds }) => {
  const [anio, mes] = mesInicio.split("-").map(Number);
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const columnaInicial = diaISO(mesInicio); // 1=lunes … 7=domingo
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  const prefijo = mesInicio.slice(0, 8); // "YYYY-MM-"

  const celdas = [];
  for (let i = 0; i < columnaInicial - 1; i += 1) celdas.push({ tipo: "relleno" });
  for (let dia = 1; dia <= diasEnMes; dia += 1) {
    const d = porFecha.get(`${prefijo}${String(dia).padStart(2, "0")}`);
    celdas.push(d ? { tipo: "dia", ...d } : { tipo: "vacia", dia });
  }

  return (
    <div className="asistencia-calendario asistencia-calendario--grande">
      {NOMBRES_DIA_SEMANA.map((n) => (
        <div key={n} className="asistencia-calendario-encabezado">{n}</div>
      ))}
      {celdas.map((c, i) => {
        if (c.tipo === "relleno") {
          return <div key={`relleno-${i}`} className="asistencia-calendario-celda asistencia-calendario-celda--vacia" />;
        }
        if (c.tipo === "vacia") {
          return (
            <div key={`vacia-${c.dia}`} className="asistencia-calendario-celda asistencia-calendario-celda--vacia">
              <span className="asistencia-calendario-numero">{c.dia}</span>
            </div>
          );
        }
        const anulable = puedeAnular && (c.entrada || c.salida);
        const justificable = !anulable && puedeJustificar && c.estado === ESTADOS_DIA.FALTA;
        const accionable = anulable || justificable;
        const accion = anulable ? () => onAnularDia(c) : justificable ? () => onJustificarDia(c) : undefined;
        const pista = anulable ? "clic para anular" : justificable ? "clic para justificar" : null;
        const porRevisar = !!revisarIds && ((c.entrada && revisarIds.has(c.entrada.id)) || (c.salida && revisarIds.has(c.salida.id)));
        const horaEntrada = c.entrada ? horaCorta(c.entrada.marcadaEn).replace(/\s?[ap]\.?\s?m\.?/i, "") : null;
        return (
          <div
            key={c.fecha}
            className={`asistencia-calendario-celda asistencia-calendario-celda--${c.estado}${accionable ? " asistencia-calendario-celda--anulable" : ""}`}
            title={pista ? `${tituloCeldaCalendario(c)} · ${pista}` : tituloCeldaCalendario(c)}
            role={accionable ? "button" : undefined}
            tabIndex={accionable ? 0 : undefined}
            onClick={accion}
            onKeyDown={accionable ? (e) => { if (e.key === "Enter" || e.key === " ") accion(); } : undefined}
          >
            <span className="asistencia-calendario-numero">
              {Number(c.fecha.slice(-2))}
              {porRevisar && <span className="asistencia-calendario-revisar" title="Requiere revisión" />}
            </span>
            {horaEntrada && <span className="asistencia-calendario-hora">{horaEntrada}</span>}
          </div>
        );
      })}
    </div>
  );
};

export default function AsistenciaPanel({ usuarios = [], horarios = [], permisos = [], vacaciones = [], puedeAnular = false, puedeJustificar = false, onJustificarFalta }) {
  const { toast, prompt, confirm } = useNotification();
  const { nombresSucursales } = useGlobal();

  const [desde, setDesde] = useState(() => primerDiaDeMes(hoyClinica()));
  const [hasta, setHasta] = useState(() => {
    const fin = ultimoDiaDeMes(primerDiaDeMes(hoyClinica()));
    const hoy = hoyClinica();
    return fin > hoy ? hoy : fin;
  });
  const [empleadoId, setEmpleadoId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("Todas");

  // Sucursal en un panel que abre el botón "Filtros"; badge con el conteo activo.
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const filtrosRef = useRef(null);
  const filtrosActivos = filtroSucursal !== "Todas" ? 1 : 0;

  const [checadas, setChecadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const irMes = (delta) => {
    const nuevoInicio = sumarMeses(primerDiaDeMes(desde), delta);
    const hoy = hoyClinica();
    const fin = ultimoDiaDeMes(nuevoInicio);
    setDesde(nuevoInicio);
    setHasta(fin > hoy ? hoy : fin);
  };
  const irMesActual = () => {
    const inicio = primerDiaDeMes(hoyClinica());
    const hoy = hoyClinica();
    const fin = ultimoDiaDeMes(inicio);
    setDesde(inicio);
    setHasta(fin > hoy ? hoy : fin);
  };
  const puedeAvanzarMes = primerDiaDeMes(desde) < primerDiaDeMes(hoyClinica());

  // Fetch local acotado por rango (todo el mes, todos los empleados): esta tabla crece sin techo y
  // el contexto se carga entero en cada login. Se carga el mes completo para poder pintar el estado
  // de cada empleado en el selector, no solo el del seleccionado.
  const cargar = useCallback(() => {
    let cancelado = false;
    getAsistencias({ desde, hasta })
      .then((rows) => { if (!cancelado) { setChecadas(rows); setError(null); } })
      .catch((e) => {
        if (cancelado) return;
        console.error("Error cargando asistencia:", e);
        setError(e?.message || "No se pudo cargar la asistencia.");
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [desde, hasta]);

  useEffect(() => cargar(), [cargar]);

  // Realtime: cuando alguien checa, aparece aquí sin recargar (payload.new no trae el join con
  // usuarios, así que se refresca desde la base para no pintar filas sin nombre).
  useEffect(() => {
    const desuscribir = subscribeAsistencias((nueva) => {
      if (nueva.fecha >= desde && nueva.fecha <= hasta) cargar();
    });
    return desuscribir;
  }, [cargar, desde, hasta]);

  const empleados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return usuarios
      .filter((u) => !u.inactivo)
      .filter((u) => !texto || (u.name || "").toLowerCase().includes(texto))
      .filter((u) => filtroSucursal === "Todas" || normalizeSucursal(u.sucursal) === filtroSucursal)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [usuarios, busqueda, filtroSucursal]);

  // Los días clasificados, por empleado (todo el criterio falta/justificado/retardo vive en
  // construirDias, probado en utils/asistencia.test.js).
  const porEmpleado = useMemo(() =>
    empleados.map((u) => {
      const dias = construirDias({
        desde,
        hasta,
        checadas: checadas.filter((c) => c.empleadoId === u.id),
        horarios: horarios.filter((h) => h.empleadoId === u.id),
        permisos: permisos.filter((p) => p.empleadoId === u.id),
        vacaciones: vacaciones.filter((v) => v.empleadoId === u.id),
        fechaIngreso: u.fechaIngreso,
      });
      return { empleado: u, dias, resumen: resumen(dias), grupos: agruparPor(dias, "dia") };
    }),
    [empleados, checadas, horarios, permisos, vacaciones, desde, hasta]
  );

  // El empleado que se está viendo: el elegido, o el primero de la lista por defecto.
  const effectiveId = empleadoId || empleados[0]?.id || "";
  const seleccionado = porEmpleado.find((e) => e.empleado.id === effectiveId) || porEmpleado[0] || null;
  const resumenSel = seleccionado ? seleccionado.resumen : resumen([]);

  // Todas las faltas VISIBLES (respeta filtros), para "justificar en bloque".
  const faltasVisibles = useMemo(
    () =>
      porEmpleado.flatMap(({ empleado, dias }) =>
        dias
          .filter((d) => d.estado === ESTADOS_DIA.FALTA)
          .map((d) => ({ empleadoId: empleado.id, empleado: empleado.name, fecha: d.fecha }))
      ),
    [porEmpleado]
  );

  // Checadas sospechosas: un punto en la celda del calendario + un punto junto al nombre en el
  // selector, para no perder la señal ahora que no hay lista aparte de "requieren revisión".
  const compartidos = useMemo(() => detectarDispositivosCompartidos(checadas), [checadas]);
  const paraRevisar = useMemo(
    () => checadas.filter((c) => requiereRevision(c) || compartidos.has(c.id)),
    [checadas, compartidos]
  );
  const revisarIds = useMemo(() => new Set(paraRevisar.map((c) => c.id)), [paraRevisar]);
  const empleadosConAlerta = useMemo(() => new Set(paraRevisar.map((c) => c.empleadoId)), [paraRevisar]);

  // Cierra el panel de "Filtros" con Escape y con clic fuera.
  useEscapeKey(() => setFiltrosAbiertos(false), filtrosAbiertos);
  useEffect(() => {
    if (!filtrosAbiertos) return;
    const onDoc = (e) => {
      if (filtrosRef.current && !filtrosRef.current.contains(e.target)) setFiltrosAbiertos(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filtrosAbiertos]);

  const handleAnular = async (checada) => {
    const nota = await prompt({
      title: "Anular checada",
      description: `¿Por qué se anula la ${checada.tipo} de ${checada.empleado}?`,
      confirmText: "Anular",
    });
    if (nota === null) return;
    try {
      await anularChecada(checada.id, nota || "Anulada por RH");
      toast.success("Checada anulada.");
      cargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo anular la checada.");
    }
  };

  // Anular desde el calendario: deja anular CUALQUIER checada (típico: limpiar un registro de
  // prueba o un error que nunca disparó ninguna alerta).
  const handleAnularDia = async (dia) => {
    if (!dia.entrada && !dia.salida) return;
    let objetivo = dia.entrada || dia.salida;
    if (dia.entrada && dia.salida) {
      const esEntrada = await confirm({
        title: "¿Qué checada anular?",
        description: `${dia.fecha} tiene entrada y salida registradas.`,
        confirmText: "Anular entrada",
        cancelText: "Anular salida",
      });
      objetivo = esEntrada ? dia.entrada : dia.salida;
    }
    handleAnular(objetivo);
  };

  // Justifica una falta (día sin checada) directo, para corregir un error del sistema.
  const handleJustificarDia = async (dia) => {
    const motivo = await prompt({
      title: "Justificar falta",
      description: `¿Por qué se justifica la falta del ${dia.fecha}?`,
      confirmText: "Justificar",
    });
    if (motivo === null) return;
    await onJustificarFalta?.({ empleadoId: dia.empleadoId, fecha: dia.fecha, motivo: motivo || "Sin especificar" });
    cargar();
  };

  // Justificar TODAS las faltas visibles de una (respeta los filtros puestos).
  const handleJustificarTodas = async () => {
    if (!faltasVisibles.length) return;
    const nombres = [...new Set(faltasVisibles.map((f) => f.empleado))];
    const ok = await confirm({
      title: "Justificar faltas en bloque",
      description: `Se van a justificar ${faltasVisibles.length} falta(s) de ${nombres.length} empleado(s) en el período y filtros actuales (${desde} a ${hasta}). Esto no se puede deshacer en bloque, solo una por una.`,
      variant: "warning",
      confirmText: "Sí, justificar todas",
    });
    if (!ok) return;
    const motivo = await prompt({
      title: "Motivo",
      description: "Un solo motivo para todas las faltas que se van a justificar.",
      confirmText: "Justificar",
    });
    if (motivo === null) return;
    let exitosas = 0;
    for (const f of faltasVisibles) {
      try {
        await onJustificarFalta?.({ empleadoId: f.empleadoId, fecha: f.fecha, motivo: motivo || "Sin especificar" });
        exitosas += 1;
      } catch {
        // onJustificarFalta ya muestra su propio toast de error; se sigue con las demás.
      }
    }
    toast.success(`${exitosas} de ${faltasVisibles.length} faltas justificadas.`);
    cargar();
  };

  // Salía como CSV con cada celda entrecomillada: horas trabajadas y puntualidad llegaban a
  // Excel como texto y no se podían sumar ni promediar. Ahora es .xlsx y esas dos columnas
  // van como número — vacías cuando no hay dato, para que un promedio de la columna no se
  // rompa por una celda con texto dentro.
  const exportarExcelAsistencia = () => {
    const filas = [];
    for (const { empleado, grupos } of porEmpleado) {
      for (const g of grupos) {
        filas.push({
          empleado: empleado.name,
          sucursal: empleado.sucursal || "",
          periodo: g.clave,
          presentes: g.resumen.presentes,
          retardos: g.resumen.retardos,
          faltas: g.resumen.faltas,
          justificados: g.resumen.justificados,
          horas: Number((g.resumen.minutosTrabajados / 60).toFixed(1)),
          puntualidad: g.resumen.puntualidad,
        });
      }
    }
    return descargarExcel({
      nombreArchivo: `asistencia_${desde}_a_${hasta}.xlsx`,
      hoja: "Asistencia",
      columnas: [
        { header: "Empleado", key: "empleado", width: 32 },
        { header: "Sucursal", key: "sucursal", width: 20 },
        { header: "Periodo", key: "periodo", width: 16 },
        { header: "Presentes", key: "presentes", width: 12, tipo: "numero" },
        { header: "Retardos", key: "retardos", width: 12, tipo: "numero" },
        { header: "Faltas", key: "faltas", width: 10, tipo: "numero" },
        { header: "Justificados", key: "justificados", width: 14, tipo: "numero" },
        { header: "Horas trabajadas", key: "horas", width: 18, tipo: "decimal" },
        { header: "Puntualidad %", key: "puntualidad", width: 15, tipo: "numero" },
      ],
      filas,
    });
  };

  const hoy = new Date();

  return (
    <div className="admin-page">
      <PageHeader icon="clock" title="Asistencia" subtitle={nombreMes(desde)}>
        {puedeJustificar && faltasVisibles.length > 0 && (
          <button type="button" className="mc-btn-outline mc-btn-outline--danger" onClick={handleJustificarTodas}>
            <Icon name="check" size={16} /> Justificar {faltasVisibles.length} falta{faltasVisibles.length === 1 ? "" : "s"}
          </button>
        )}
        <button type="button" className="mc-btn-outline" onClick={exportarExcelAsistencia} disabled={cargando}>
          <Icon name="file" size={16} /> Exportar Excel
        </button>
      </PageHeader>

      <Card className="asistencia-toolbar-card">
        <div className="asistencia-toolbar">
          <input
            type="text"
            className="table-search asistencia-toolbar-search"
            placeholder="Buscar empleado por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="asistencia-filtros-wrap" ref={filtrosRef}>
            <button
              type="button"
              className={`mc-btn-outline asistencia-filtros-btn${filtrosAbiertos ? " asistencia-filtros-btn--abierto" : ""}`}
              onClick={() => setFiltrosAbiertos((v) => !v)}
              aria-expanded={filtrosAbiertos}
            >
              Filtros
              {filtrosActivos > 0 && <span className="asistencia-filtros-badge">{filtrosActivos}</span>}
              <Icon name="chevronDown" size={15} className="asistencia-filtros-caret" />
            </button>
            {filtrosAbiertos && (
              <div className="asistencia-filtros-panel">
                <label>
                  Sucursal
                  <select className="list-filter-select" value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
                    <option value="Todas">Todas las sucursales</option>
                    {nombresSucursales.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <Card>
          <p className="mc-empty"><Icon name="alert" size={16} /> {error}</p>
        </Card>
      )}

      {cargando ? (
        <Card><p className="mc-empty">Cargando asistencia…</p></Card>
      ) : empleados.length === 0 ? (
        <Card><p className="mc-empty">No hay empleados que mostrar.</p></Card>
      ) : (
        <div className="asistencia-layout">
          {/* Selector de empleado: la lista sigue dando el vistazo general (quién tiene faltas o
              alertas), y al elegir uno se ve su calendario grande a la derecha. */}
          <div className="asistencia-emp-lista">
            {porEmpleado.map(({ empleado, resumen: r }) => (
              <button
                key={empleado.id}
                type="button"
                className={`asistencia-emp-item${empleado.id === effectiveId ? " asistencia-emp-item--activo" : ""}`}
                onClick={() => setEmpleadoId(empleado.id)}
              >
                <div className="asistencia-emp-item-main">
                  <span className="asistencia-emp-item-nombre">
                    {empleadosConAlerta.has(empleado.id) && (
                      <span className="asistencia-empleado-alerta" title="Tiene checadas que requieren revisión" />
                    )}
                    {empleado.name}
                  </span>
                  <span className="asistencia-emp-item-suc">{normalizeSucursal(empleado.sucursal)}</span>
                </div>
                <span className="asistencia-emp-item-estado">
                  {r.faltas > 0
                    ? <span className="mc-status-pill mc-status-pill--rechazado">{r.faltas} falta{r.faltas === 1 ? "" : "s"}</span>
                    : r.retardos > 0
                      ? <span className="mc-status-pill mc-status-pill--pendiente">{r.retardos} retardo{r.retardos === 1 ? "" : "s"}</span>
                      : <span className="mc-status-pill mc-status-pill--aprobado">Al corriente</span>}
                </span>
              </button>
            ))}
          </div>

          <div className="asistencia-cal-panel">
            {seleccionado && (
              <Card className="asistencia-cal-card">
                {/* Cabecera del calendario (estilo pestaña Calendario): badge de hoy + mes + nav. */}
                <div className="asistencia-cal-header">
                  <div className="asistencia-cal-title">
                    <div className="agenda-badge">
                      <span className="agenda-badge-mes">{MES_ABR[hoy.getMonth()]}</span>
                      <span className="agenda-badge-dia">{hoy.getDate()}</span>
                    </div>
                    <div>
                      <div className="asistencia-cal-emp">{seleccionado.empleado.name}</div>
                      <strong className="asistencia-cal-mes">{nombreMes(desde)}</strong>
                    </div>
                  </div>
                  <div className="asistencia-cal-nav">
                    <button type="button" className="cal-nav" onClick={() => irMes(-1)} aria-label="Mes anterior">‹</button>
                    <button type="button" className="agenda-hoy" onClick={irMesActual}>Hoy</button>
                    <button type="button" className="cal-nav" onClick={() => irMes(1)} disabled={!puedeAvanzarMes} aria-label="Mes siguiente">›</button>
                  </div>
                </div>

                {/* Resumen del mes del empleado seleccionado. */}
                <div className="asistencia-cal-resumen">
                  {[
                    { label: "Presentes", value: resumenSel.presentes, estado: "presente" },
                    { label: "Retardos", value: resumenSel.retardos, estado: "retardo" },
                    { label: "Faltas", value: resumenSel.faltas, estado: "falta" },
                    { label: "Justificados", value: resumenSel.justificados, estado: "justificado" },
                    { label: "Sin salida", value: resumenSel.incompletos, estado: "incompleto" },
                  ].map((s) => (
                    <div key={s.label} className="asistencia-cal-resumen-item">
                      <span className={`asistencia-leyenda-swatch asistencia-calendario-celda--${s.estado}`} />
                      <strong>{s.value}</strong> {s.label}
                    </div>
                  ))}
                  <div className="asistencia-cal-resumen-item asistencia-cal-resumen-item--horas">
                    <Icon name="clock" size={14} /> {minutosAHoras(resumenSel.minutosTrabajados)} ·{" "}
                    {resumenSel.puntualidad == null ? "sin evaluar" : `${resumenSel.puntualidad}% puntual`}
                  </div>
                </div>

                {/* Leyenda de colores. */}
                <div className="asistencia-leyenda">
                  {LEYENDA.map((l) => (
                    <span key={l.estado} className="asistencia-leyenda-item">
                      <span className={`asistencia-leyenda-swatch asistencia-calendario-celda--${l.estado}`} />
                      {l.label}
                    </span>
                  ))}
                </div>

                <CalendarioMes
                  dias={seleccionado.dias}
                  mesInicio={primerDiaDeMes(desde)}
                  puedeAnular={puedeAnular}
                  onAnularDia={handleAnularDia}
                  puedeJustificar={puedeJustificar}
                  onJustificarDia={(dia) => handleJustificarDia({ ...dia, empleadoId: seleccionado.empleado.id })}
                  revisarIds={revisarIds}
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
