import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import {
  getAsistencias,
  subscribeAsistencias,
  getSignedUrlSelfie,
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
import { SUCURSALES, normalizeSucursal } from "../../utils/constants";

const GRANULARIDADES = [
  { valor: "dia", label: "Día" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mes" },
  { valor: "anio", label: "Año" },
];

const ETIQUETA_ESTADO = {
  [ESTADOS_DIA.PRESENTE]: "Presente",
  [ESTADOS_DIA.RETARDO]: "Retardo",
  [ESTADOS_DIA.FALTA]: "Falta",
  [ESTADOS_DIA.JUSTIFICADO]: "Justificado",
  [ESTADOS_DIA.DESCANSO]: "Descanso",
  [ESTADOS_DIA.INCOMPLETO]: "Sin salida",
  [ESTADOS_DIA.PENDIENTE]: "En curso",
};

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

// ---------------------------------------------------------------------------
// Navegación mes a mes (solo para granularidad "día"): en vez de un rango de fechas
// libre, un calendario navega por meses completos. Todo en UTC para no correr el mes
// por el huso horario del navegador, mismo criterio que rangoDeFechas en utils/asistencia.js.
// ---------------------------------------------------------------------------
const primerDiaDeMes = (fecha) => `${String(fecha).slice(0, 7)}-01`;

const ultimoDiaDeMes = (fecha) => {
  const [y, m] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // día 0 del mes siguiente
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

/** Un mes completo en cuadrícula (7 columnas, Lun-Dom). `dias` trae solo los días que
 * existen de verdad (dentro del rango cargado y desde la fecha de ingreso); los que
 * faltan (antes de ingresar, o después de "hoy" si es el mes en curso) se pintan como
 * celda vacía, sin color ni tooltip. */
const CalendarioMes = ({ dias, mesInicio, puedeAnular, onAnularDia, puedeJustificar, onJustificarDia }) => {
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
    <div className="asistencia-calendario">
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
        // Anular (hay checada) y justificar (falta, sin checada) son mutuamente
        // excluyentes: una falta es justo un día SIN entrada ni salida.
        const anulable = puedeAnular && (c.entrada || c.salida);
        const justificable = !anulable && puedeJustificar && c.estado === ESTADOS_DIA.FALTA;
        const accionable = anulable || justificable;
        const accion = anulable ? () => onAnularDia(c) : justificable ? () => onJustificarDia(c) : undefined;
        const pista = anulable ? "clic para anular" : justificable ? "clic para justificar" : null;
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
            <span className="asistencia-calendario-numero">{Number(c.fecha.slice(-2))}</span>
          </div>
        );
      })}
    </div>
  );
};

export default function AsistenciaPanel({ usuarios = [], horarios = [], permisos = [], vacaciones = [], puedeAnular = false, puedeJustificar = false, onJustificarFalta }) {
  const { toast, prompt, confirm } = useNotification();

  const [desde, setDesde] = useState(() => primerDiaDeMes(hoyClinica()));
  const [hasta, setHasta] = useState(hoyClinica());
  const [granularidad, setGranularidad] = useState("dia");
  const [empleadoId, setEmpleadoId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("Todas");

  // Sucursal y Empleado viven en un panel que se abre con el botón "Filtros" (la búsqueda,
  // la granularidad y el navegador de fecha quedan siempre a la vista). El badge cuenta
  // cuántos de esos dos están puestos, para no perderlos de vista con el panel cerrado.
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const filtrosRef = useRef(null);
  const filtrosActivos = (filtroSucursal !== "Todas" ? 1 : 0) + (empleadoId ? 1 : 0);

  const [checadas, setChecadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // En "día" se navega mes a mes (calendario), no con un rango libre. Al entrar a ese
  // modo desde otro se acota el rango al mes que contenga la fecha "hasta" actual —
  // así un cambio de granularidad no deja un rango a medias que el calendario no
  // sabría dibujar. Se hace en el propio onChange (evento de usuario), no en un efecto:
  // un setState síncrono en un efecto encadena un render extra de más (lo marca
  // react-hooks/set-state-in-effect), y aquí no hace falta — el mount ya arranca con
  // desde/hasta acotados al mes actual desde el estado inicial.
  const cambiarGranularidad = (valor) => {
    if (valor === "dia") {
      const inicio = primerDiaDeMes(hasta);
      const hoy = hoyClinica();
      const fin = ultimoDiaDeMes(inicio);
      setDesde(inicio);
      setHasta(fin > hoy ? hoy : fin);
    }
    setGranularidad(valor);
  };

  const irMes = (delta) => {
    const nuevoInicio = sumarMeses(primerDiaDeMes(desde), delta);
    const hoy = hoyClinica();
    const fin = ultimoDiaDeMes(nuevoInicio);
    setDesde(nuevoInicio);
    setHasta(fin > hoy ? hoy : fin);
  };

  const puedeAvanzarMes = primerDiaDeMes(desde) < primerDiaDeMes(hoyClinica());

  // Fetch local acotado por rango, NO desde GlobalContext: esta tabla crece sin techo y
  // el contexto se carga entero en cada login. Mismo patrón que BolsaTrabajo.jsx.
  //
  // El estado se toca SOLO en los callbacks del promise, nunca en el cuerpo síncrono del
  // efecto: un setState síncrono ahí encadena un render extra en cada montaje (lo avisa
  // react-hooks/set-state-in-effect).
  //
  // Consecuencia buscada: `cargando` solo vale para la carga inicial. Al cambiar un filtro
  // se sigue viendo la tabla anterior hasta que llega la nueva, en vez de parpadear a
  // "Cargando…" y volver. Es menos brusco y no esconde la información que RH estaba
  // mirando.
  //
  // `cancelado` evita escribir estado de una petición vieja: si RH cambia el rango dos
  // veces seguidas, la primera respuesta puede llegar DESPUÉS de la segunda y pisarla con
  // datos que ya no son los que se están mirando.
  const cargar = useCallback(() => {
    let cancelado = false;

    getAsistencias({ desde, hasta, empleadoId: empleadoId || undefined })
      .then((rows) => {
        if (cancelado) return;
        setChecadas(rows);
        setError(null);
      })
      .catch((e) => {
        if (cancelado) return;
        console.error("Error cargando asistencia:", e);
        setError(e?.message || "No se pudo cargar la asistencia.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => { cancelado = true; };
  }, [desde, hasta, empleadoId]);

  useEffect(() => cargar(), [cargar]);

  // Realtime: cuando alguien checa, aparece aquí sin recargar.
  //
  // OJO: payload.new de Postgres NO trae el join con usuarios, así que la fila llega sin
  // nombre ni sucursal. En vez de pintar una fila con el nombre vacío, se refresca desde
  // la base — el coste es una consulta por checada y la alternativa es una interfaz que
  // enseña huecos.
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

  // Los días clasificados, por empleado. Es donde vive todo el criterio (falta vs
  // justificado vs retardo) y está probado en src/utils/asistencia.test.js.
  const porEmpleado = useMemo(() => {
    const objetivo = empleadoId ? empleados.filter((u) => u.id === empleadoId) : empleados;

    return objetivo.map((u) => {
      const dias = construirDias({
        desde,
        hasta,
        checadas: checadas.filter((c) => c.empleadoId === u.id),
        horarios: horarios.filter((h) => h.empleadoId === u.id),
        permisos: permisos.filter((p) => p.empleadoId === u.id),
        vacaciones: vacaciones.filter((v) => v.empleadoId === u.id),
        fechaIngreso: u.fechaIngreso,
      });
      return { empleado: u, dias, resumen: resumen(dias), grupos: agruparPor(dias, granularidad) };
    });
  }, [empleados, empleadoId, checadas, horarios, permisos, vacaciones, desde, hasta, granularidad]);

  const totales = useMemo(
    () => resumen(porEmpleado.flatMap((e) => e.dias)),
    [porEmpleado]
  );

  // Todas las faltas VISIBLES ahora mismo (respeta los filtros ya puestos: rango de
  // fechas, empleado, sucursal, búsqueda) — es lo que hace que "justificar en bloque"
  // sea preciso: filtrás a quién/cuándo aplica, y el botón actúa solo sobre eso.
  const faltasVisibles = useMemo(
    () =>
      porEmpleado.flatMap(({ empleado, dias }) =>
        dias
          .filter((d) => d.estado === ESTADOS_DIA.FALTA)
          .map((d) => ({ empleadoId: empleado.id, empleado: empleado.name, fecha: d.fecha }))
      ),
    [porEmpleado]
  );

  // Un mismo teléfono checando a dos personas distintas el mismo día. Es la señal más
  // fuerte de suplantación y necesita ver el conjunto del día, no una checada suelta.
  const compartidos = useMemo(() => detectarDispositivosCompartidos(checadas), [checadas]);

  const paraRevisar = useMemo(
    () => checadas.filter((c) => requiereRevision(c) || compartidos.has(c.id)),
    [checadas, compartidos]
  );

  // Empleados con al menos una checada sospechosa: conecta la lista de revisión con su
  // fila del acordeón mediante un puntito de alerta (decisión A+C de la sesión).
  const empleadosConAlerta = useMemo(
    () => new Set(paraRevisar.map((c) => c.empleadoId)),
    [paraRevisar]
  );

  // Cierra el panel de "Filtros" con Escape y con clic fuera (mismo patrón que WeekSelect).
  useEscapeKey(() => setFiltrosAbiertos(false), filtrosAbiertos);
  useEffect(() => {
    if (!filtrosAbiertos) return;
    const onDoc = (e) => {
      if (filtrosRef.current && !filtrosRef.current.contains(e.target)) setFiltrosAbiertos(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filtrosAbiertos]);

  // Por qué está marcada esta checada. Se enseña el motivo, no un icono de alerta a secas:
  // sin saber QUÉ mirar, RH no puede accionar nada y acaba ignorando la lista entera.
  const motivoRevision = (c) => {
    // La cara primero: es lo más grave que puede decir el sistema.
    if (c.rostroVerificado === false) return "La cara de la foto NO coincide con la de esta persona.";
    if (compartidos.has(c.id)) return "Este mismo teléfono checó hoy a más de un empleado.";
    if (c.ubicacionEstado === "fuera") return `A ${c.distanciaM} m de ${c.sucursal}: fuera del área permitida.`;
    if (c.dispositivoNuevo) return "Checó desde un teléfono que nunca había usado.";
    if (!c.selfiePath && !c.fotoPurgada) return "Se registró sin foto.";
    if (c.ubicacionEstado === "sin_gps") return "Sin ubicación: no dio permiso de GPS o falló.";
    return "";
  };

  const verSelfie = async (checada) => {
    if (checada.fotoPurgada) {
      // Se distingue de "se registró sin foto": una es el funcionamiento normal, la otra es un
      // hueco. Decirle lo mismo a RH en los dos casos le haría desconfiar de checadas
      // perfectamente correctas.
      toast.info("La foto se borró: solo se conservan una semana.");
      return;
    }
    if (!checada.selfiePath) {
      toast.info("Esa checada se registró sin foto.");
      return;
    }
    try {
      const url = await getSignedUrlSelfie(checada.selfiePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("No se pudo abrir la foto.");
    }
  };

  const handleAnular = async (checada) => {
    const nota = await prompt({
      title: "Anular checada",
      description: `¿Por qué se anula la ${checada.tipo} de ${checada.empleado}?`,
      confirmText: "Anular",
    });
    if (nota === null) return; // canceló

    try {
      await anularChecada(checada.id, nota || "Anulada por RH");
      toast.success("Checada anulada.");
      cargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo anular la checada.");
    }
  };

  // Anular desde el calendario: a diferencia de "requiere revisión" (solo checadas
  // marcadas como sospechosas), esto deja anular CUALQUIER checada — el caso típico es
  // limpiar un registro de prueba o un error que nunca disparó ninguna alerta.
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

  // Justifica una falta (día sin ninguna checada) directo, sin pasar por el flujo normal
  // de solicitud+aprobación de permisos — para corregir un error del sistema (checador
  // que falló, horario mal cargado), no una ausencia real que alguien tenga que pedir.
  const handleJustificarDia = async (dia) => {
    const motivo = await prompt({
      title: "Justificar falta",
      description: `¿Por qué se justifica la falta del ${dia.fecha}?`,
      confirmText: "Justificar",
    });
    if (motivo === null) return; // canceló
    await onJustificarFalta?.({ empleadoId: dia.empleadoId, fecha: dia.fecha, motivo: motivo || "Sin especificar" });
    cargar();
  };

  // Justificar TODAS las faltas visibles de una — un feriado que nadie cargó, un corte de
  // luz, el primer día de uso real del sistema. Respeta los filtros puestos (fechas,
  // empleado, sucursal): si querés acotarlo a una persona o una sucursal, filtrá primero.
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

  const exportarCSV = () => {
    const filas = [
      ["Empleado", "Sucursal", "Periodo", "Presentes", "Retardos", "Faltas", "Justificados", "Horas trabajadas", "Puntualidad %"],
    ];

    for (const { empleado, grupos } of porEmpleado) {
      for (const g of grupos) {
        filas.push([
          empleado.name,
          empleado.sucursal || "",
          g.clave,
          g.resumen.presentes,
          g.resumen.retardos,
          g.resumen.faltas,
          g.resumen.justificados,
          (g.resumen.minutosTrabajados / 60).toFixed(1),
          g.resumen.puntualidad ?? "",
        ]);
      }
    }

    const contenido = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    // El BOM es lo que hace que Excel abra los acentos bien en vez de "MartÃ­nez". Se
    // escribe escapado (\uFEFF) y no como carácter literal: un BOM invisible pegado en el
    // código es imposible de ver al revisar un diff. Mismo efecto que en rh/Reportes.jsx.
    const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asistencia_${desde}_a_${hasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="clock"
        title="Asistencia"
        subtitle={granularidad === "dia" ? nombreMes(desde) : `Del ${desde} al ${hasta}`}
      >
        {puedeJustificar && faltasVisibles.length > 0 && (
          <button type="button" className="mc-btn-outline mc-btn-outline--danger" onClick={handleJustificarTodas}>
            <Icon name="check" size={16} /> Justificar {faltasVisibles.length} falta{faltasVisibles.length === 1 ? "" : "s"}
          </button>
        )}
        <button type="button" className="mc-btn-outline" onClick={exportarCSV} disabled={cargando}>
          <Icon name="file" size={16} /> Exportar CSV
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

          {/* Granularidad: control segmentado siempre a la vista — reconfigura el modo
              entero de la pantalla (calendario vs periodos), no es un filtro de acotar. */}
          <div className="asistencia-segmented" role="group" aria-label="Agrupar por">
            {GRANULARIDADES.map((g) => (
              <button
                key={g.valor}
                type="button"
                className={`asistencia-segmented-btn${granularidad === g.valor ? " asistencia-segmented-btn--activo" : ""}`}
                aria-pressed={granularidad === g.valor}
                onClick={() => cambiarGranularidad(g.valor)}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Navegador de fecha: mes a mes en "día", rango libre en el resto. */}
          {granularidad === "dia" ? (
            <div className="asistencia-mes-nav">
              <button type="button" className="mc-btn-outline" onClick={() => irMes(-1)} aria-label="Mes anterior">‹</button>
              <strong className="asistencia-mes-nav-label">{nombreMes(desde)}</strong>
              <button type="button" className="mc-btn-outline" onClick={() => irMes(1)} disabled={!puedeAvanzarMes} aria-label="Mes siguiente">›</button>
            </div>
          ) : (
            <div className="asistencia-rango">
              <label>
                Desde
                <input type="date" className="list-filter-input" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label>
                Hasta
                <input type="date" className="list-filter-input" value={hasta} min={desde} max={hoyClinica()} onChange={(e) => setHasta(e.target.value)} />
              </label>
            </div>
          )}

          {/* Sucursal + Empleado en un panel bajo el botón; badge con el conteo activo. */}
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
                    {SUCURSALES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Empleado
                  <select className="list-filter-select" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                    <option value="">Todos</option>
                    {empleados.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
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
          <p className="mc-empty">
            <Icon name="alert" size={16} /> {error}
          </p>
        </Card>
      )}

      {/* Tira compacta de 6: una fila (wrap 3+3 / 2col en móvil), sin el hueco 4+2 de
          las cards grandes y recuperando alto para el detalle. */}
      <div className="asistencia-stat-strip">
        {[
          { icon: "check", value: totales.presentes, label: "Presentes", clase: "admin-stat-value--green" },
          { icon: "clock", value: totales.retardos, label: "Retardos", clase: "admin-stat-value--amber" },
          { icon: "alert", value: totales.faltas, label: "Faltas", clase: "admin-stat-value--red" },
          { icon: "vacation", value: totales.justificados, label: "Justificados", clase: "admin-stat-value--blue" },
          { icon: "history", value: totales.incompletos, label: "Sin salida", clase: "admin-stat-value--aqua" },
          { icon: "clock", value: totales.pendientes, label: "Pendientes", clase: "admin-stat-value--orange" },
        ].map((t) => (
          <div key={t.label} className="asistencia-stat-tile">
            <span className="asistencia-stat-tile-icon"><Icon name={t.icon} size={16} /></span>
            <span className="asistencia-stat-tile-body">
              <span className={`asistencia-stat-tile-value ${t.clase}`}>{t.value}</span>
              <span className="asistencia-stat-tile-label">{t.label}</span>
            </span>
          </div>
        ))}
      </div>

      {paraRevisar.length > 0 && (
        <section className="asistencia-revision">
          <SectionTitle icon="alert">Checadas que requieren revisión ({paraRevisar.length})</SectionTitle>
          {/* Esta lista es lo que hace que la comprobación sirva de algo: alguien la mira.
              Una selfie y una coordenada que nadie revisa son teatro. Mismo patrón
              rh-data-list/rh-data-row que PermisosRH/VacacionesRH: colapsa solo en móvil. */}
          <div className="rh-data-list">
            {paraRevisar.map((c) => (
              <div key={c.id} className="rh-data-row">
                <div className="rh-data-row-main">
                  <div className="rh-data-row-title">{c.empleado}</div>
                  <div className="rh-data-row-detail">{motivoRevision(c)}</div>
                </div>
                <div className="rh-data-row-meta">
                  <div className="rh-data-row-meta-primary">{c.tipo === "entrada" ? "Entrada" : "Salida"}</div>
                  <div className="rh-data-row-meta-secondary">{c.fecha} · {horaCorta(c.marcadaEn)}</div>
                </div>
                <div className="rh-data-row-actions">
                  {c.selfiePath && (
                    <button type="button" className="mc-btn-outline" onClick={() => verSelfie(c)}>
                      <Icon name="camera" size={15} /> Ver foto
                    </button>
                  )}
                  {puedeAnular && (
                    <button type="button" className="mc-btn-outline mc-btn-outline--danger" onClick={() => handleAnular(c)}>
                      Anular
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <SectionTitle icon="users">Detalle por empleado</SectionTitle>

      {cargando ? (
        <Card><p className="mc-empty">Cargando asistencia…</p></Card>
      ) : porEmpleado.length === 0 ? (
        <Card><p className="mc-empty">No hay empleados que mostrar.</p></Card>
      ) : (
        <div className="rh-data-list">
          {porEmpleado.map(({ empleado, resumen: r, grupos, dias }) => (
            <details key={empleado.id} className="asistencia-empleado-row" open={empleadoId === empleado.id}>
              <summary className="rh-data-row">
                <div className="rh-data-row-main">
                  <div className="rh-data-row-title">
                    {empleadosConAlerta.has(empleado.id) && (
                      <span className="asistencia-empleado-alerta" title="Tiene checadas que requieren revisión" />
                    )}
                    {empleado.name}
                  </div>
                  <div className="rh-data-row-sub">{empleado.sucursal}</div>
                </div>
                <div className="rh-data-row-meta">
                  <div className="rh-data-row-meta-primary">{r.puntualidad == null ? "Sin evaluar" : `${r.puntualidad}% puntual`}</div>
                  <div className="rh-data-row-meta-secondary">{minutosAHoras(r.minutosTrabajados)}</div>
                </div>
                <div className="rh-data-row-status">
                  {r.faltas > 0 && <span className="mc-status-pill mc-status-pill--rechazado">{r.faltas} faltas</span>}
                  {r.retardos > 0 && <span className="mc-status-pill mc-status-pill--pendiente">{r.retardos} retardos</span>}
                  {r.faltas === 0 && r.retardos === 0 && (
                    <span className="mc-status-pill mc-status-pill--aprobado">Al corriente</span>
                  )}
                </div>
                <Icon name="chevronDown" size={18} className="asistencia-empleado-chevron" />
              </summary>

              <div className="asistencia-empleado-detalle">
                {granularidad === "dia" ? (
                  // A nivel día, el detalle es un calendario del mes en curso (la
                  // navegación de arriba ya garantiza que desde-hasta es un mes completo).
                  <CalendarioMes
                    dias={dias}
                    mesInicio={primerDiaDeMes(desde)}
                    puedeAnular={puedeAnular}
                    onAnularDia={handleAnularDia}
                    puedeJustificar={puedeJustificar}
                    onJustificarDia={(dia) => handleJustificarDia({ ...dia, empleadoId: empleado.id })}
                  />
                ) : (
                  <div className="asistencia-periodos">
                    {grupos.map((g) => (
                      <div key={g.clave} className="asistencia-periodo-row">
                        <span className="asistencia-periodo-clave">{g.clave}</span>
                        <span className="asistencia-periodo-stats">
                          {g.resumen.presentes} pres. · {g.resumen.retardos || 0} ret. · {g.resumen.faltas || 0} falt. ·{" "}
                          {g.resumen.justificados || 0} just. · {minutosAHoras(g.resumen.minutosTrabajados)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
