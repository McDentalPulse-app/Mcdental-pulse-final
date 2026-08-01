import React, { useMemo, useState } from "react";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { normalizeSucursal, sucursalMatches, formatSemanaDisplay } from "../../utils/constants";
import { esEmpleadoActivo } from "../../utils/helpers";
import { tieneScoreValido } from "../../utils/pulseScore";
import { readRiesgoRenuncia, readProblemaPersonal, getComentarioAbierto } from "../../utils/encuestaDetail";
import { descargarExcel } from "../../utils/exportarExcel";
import { periodosDisponibles, periodosEnRango, encuestaEnPeriodo, esPeriodoDePrueba, inicioDePeriodo, finDePeriodo } from "../../utils/periodos";
import { useGlobal } from "../../contexts/GlobalContext";
import { getAsistencias } from "../../services/supabase/asistenciasService";
import {
  construirDias,
  resumen as resumirDias,
  ETIQUETA_ESTADO,
  FECHA_INICIO_ASISTENCIA,
} from "../../utils/asistencia";

// Antes había un "Reporte Semanal" y un "Reporte Mensual", los dos clavados al periodo en
// curso: no había forma de sacar la semana pasada ni el mes pasado, y para colmo cada uno
// agrupaba con un criterio distinto. Ahora son DOS FORMAS de mirar —detalle (una fila por
// encuesta) y consolidado (una fila por persona)— y el periodo se elige aparte: semana,
// quincena o mes, el actual o cualquier anterior con datos. Qué entra en cada periodo lo
// decide utils/periodos.js, en un solo sitio y con sus motivos escritos.
const hoy = () => new Date().toISOString().slice(0, 10);

// Qué se está reportando. Antes cada familia vivía en su propia pantalla: las encuestas
// aquí, la asistencia dentro del calendario de Asistencia con su propio botón y su propio
// rango, y vacaciones/permisos en "Reportes RH", donde ni siquiera se podían descargar. Son
// tres preguntas distintas sobre lo mismo -qué quiero, de cuándo- y ahora se responden en un
// solo sitio.
const TIPOS_REPORTE = [
  { value: "asistencia", label: "Asistencia" },
  { value: "bienestar", label: "Bienestar (encuestas)" },
  { value: "ausencias", label: "Vacaciones, permisos y descuentos" },
];

const TIPOS = [
  { value: "semana", label: "Semana", pista: "lunes a domingo" },
  { value: "quincena", label: "Quincena", pista: "sábado a viernes, 14 días" },
  { value: "mes", label: "Mes", pista: "las semanas que empiezan en el mes" },
];

const Reportes = ({ users = [], encuestas = [], preguntas = [] }) => {
  const [sucursalReporte, setSucursalReporte] = useState("Todas");
  const [mostrarSelectorSucursal, setMostrarSelectorSucursal] = useState(false);
  const [tipoPeriodo, setTipoPeriodo] = useState("semana");
  const [periodoElegido, setPeriodoElegido] = useState(null);
  const [tipoReporte, setTipoReporte] = useState("asistencia");
  const [bajando, setBajando] = useState(false);
  const { horarios = [], permisos = [], vacaciones = [], descuentos = [] } = useGlobal();

  // Los periodos que se ofrecen dependen de lo que se va a reportar: los de bienestar salen
  // de las encuestas que existen, y los de asistencia y ausencias del calendario — un periodo
  // sin encuestas puede tener diez días de checadas o unas vacaciones a la mitad.
  const periodos = useMemo(() => {
    if (tipoReporte === "bienestar") return periodosDisponibles(encuestas, tipoPeriodo);
    const hoyISO = new Date().toISOString().slice(0, 10);
    const fechas = tipoReporte === "ausencias"
      ? [...vacaciones.map((v) => v.fechaInicio), ...permisos.map((p) => p.fecha), ...descuentos.map((d) => d.fecha)]
        .filter(Boolean).map((f) => String(f).slice(0, 10))
      : [];
    const inicio = fechas.length ? fechas.sort()[0] : FECHA_INICIO_ASISTENCIA;
    return periodosEnRango(tipoPeriodo, inicio, hoyISO);
  }, [tipoReporte, tipoPeriodo, encuestas, vacaciones, permisos, descuentos]);
  // Al cambiar de tipo, el id elegido deja de existir: se cae al más reciente en vez de
  // guardarlo en un efecto, que solo añadiría un render de más y una forma de desincronizarse.
  const periodo = periodos.find((p) => p.id === periodoElegido) || periodos[0];
  const tipoActual = TIPOS.find((t) => t.value === tipoPeriodo);

  const sucursalesReporte = [
    "Todas",
    ...Array.from(
      new Set(
        users
          .filter(esEmpleadoActivo)
          .map((u) => normalizeSucursal(u.sucursal))
          .filter(Boolean)
      )
    ).sort()
  ];

  const empleadosActivos = users.filter(esEmpleadoActivo);
  const encuestasDelPeriodo = periodo
    ? encuestas.filter((e) => encuestaEnPeriodo(e, tipoPeriodo, periodo.id))
    : [];

  // Para el nombre del archivo: "2026-W31", "2026-07-18", "2026-07" ya son inequívocos.
  const sufijo = periodo ? periodo.id.replace(/[^\w-]/g, "") : hoy();
  const desdePeriodo = periodo ? inicioDePeriodo(tipoPeriodo, periodo.id) : null;
  const hastaPeriodo = periodo ? finDePeriodo(tipoPeriodo, periodo.id) : null;

  // ¿Este registro con fecha (o rango) toca el periodo elegido? Una vacación de cinco días
  // que empieza el viernes y acaba el martes pertenece a las DOS semanas que cruza: se
  // pregunta por solapamiento, no por el día en que empezó.
  const tocaPeriodo = (inicio, fin) => {
    if (!desdePeriodo || !hastaPeriodo) return false;
    const a = String(inicio || "").slice(0, 10);
    if (!a) return false;
    const b = String(fin || inicio).slice(0, 10);
    return a <= hastaPeriodo && b >= desdePeriodo;
  };

  const ultimaEncuestaDe = (empleadoId, lista) =>
    lista
      .filter((e) => e.empleadoId === empleadoId && tieneScoreValido(e.score))
      .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")))[0];

  const descargarDetalle = () => {
    const filas = encuestasDelPeriodo
      .filter((e) => tieneScoreValido(e.score))
      .map((encuesta) => {
        const emp = empleadosActivos.find((e) => e.id === encuesta.empleadoId);
        return {
          nombre: emp?.name || "Empleado no encontrado",
          sucursal: normalizeSucursal(emp?.sucursal) || "Sin sucursal",
          puesto: emp?.puesto || "Sin puesto",
          semana: formatSemanaDisplay(encuesta.semana) || "",
          fecha: encuesta.fecha || "",
          score: Number(encuesta.score),
          semaforo: encuesta.semaforo || "Sin datos",
          // El jsonb `respuestas` se indexa por el id de la pregunta (un UUID), no por un
          // número: buscar la clave 9 / 7 / 10 dejaba estas tres columnas SIEMPRE vacías.
          riesgoRenuncia: readRiesgoRenuncia(encuesta, preguntas) || "",
          problemaPersonal: readProblemaPersonal(encuesta, preguntas) || "",
          comentario: getComentarioAbierto(encuesta, preguntas) || ""
        };
      });
    return descargarExcel({
      nombreArchivo: `detalle_${tipoPeriodo}_${sufijo}.xlsx`,
      hoja: "Detalle",
      columnas: [
        { header: "Nombre", key: "nombre", width: 32 },
        { header: "Sucursal", key: "sucursal", width: 20 },
        { header: "Puesto", key: "puesto", width: 22 },
        { header: "Semana", key: "semana", width: 16 },
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Score", key: "score", width: 10, tipo: "numero" },
        { header: "Semáforo", key: "semaforo", width: 12 },
        { header: "Riesgo renuncia", key: "riesgoRenuncia", width: 22 },
        { header: "Problema personal", key: "problemaPersonal", width: 22 },
        { header: "Comentario", key: "comentario", width: 60 },
      ],
      filas,
    });
  };

  const descargarConsolidado = () => {
    const dePrueba = periodo ? esPeriodoDePrueba(tipoPeriodo, periodo.id) : false;
    const filas = empleadosActivos.map((emp) => {
      const suyas = encuestasDelPeriodo
        .filter((e) => e.empleadoId === emp.id && tieneScoreValido(e.score))
        .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")));
      const ultima = suyas[0];
      // Una celda vacía no dice si la persona no quiso contestar o si la app no estaba en
      // uso todavía. Se escribe cuál de los dos silencios es, en una columna de texto — los
      // números se quedan vacíos a propósito, para que los promedios de la hoja no se rompan.
      const estado = suyas.length
        ? "Contestó"
        : dePrueba
          ? "No realizada · periodo de prueba de la app"
          : "No contestó";
      return {
        nombre: emp.name || "",
        sucursal: normalizeSucursal(emp.sucursal) || "",
        puesto: emp.puesto || "",
        contestadas: suyas.length,
        estado,
        ultimaSemana: ultima?.semana ? formatSemanaDisplay(ultima.semana) : "—",
        promedio: suyas.length
          ? Math.round(suyas.reduce((sum, e) => sum + Number(e.score), 0) / suyas.length)
          : null,
        scoreActual: tieneScoreValido(ultima?.score) ? Number(ultima.score) : null,
        semaforo: ultima?.semaforo || "—"
      };
    });
    return descargarExcel({
      nombreArchivo: `consolidado_${tipoPeriodo}_${sufijo}.xlsx`,
      hoja: "Consolidado",
      columnas: [
        { header: "Nombre", key: "nombre", width: 32 },
        { header: "Sucursal", key: "sucursal", width: 20 },
        { header: "Puesto", key: "puesto", width: 22 },
        { header: "Encuestas contestadas", key: "contestadas", width: 22, tipo: "numero" },
        { header: "Estado", key: "estado", width: 38 },
        { header: "Última semana", key: "ultimaSemana", width: 16 },
        { header: "Score promedio", key: "promedio", width: 16, tipo: "numero" },
        { header: "Score más reciente", key: "scoreActual", width: 18, tipo: "numero" },
        { header: "Semáforo", key: "semaforo", width: 12 },
      ],
      filas,
    });
  };

  // Sucursal y Directorio NO dependen del periodo: son una foto de cómo está la plantilla
  // hoy, con la última encuesta de cada quien sea de cuando sea.
  const descargarReporteSucursal = () => {
    const filas = empleadosActivos
      .filter((u) => sucursalReporte === "Todas" || sucursalMatches(u.sucursal, sucursalReporte))
      .map((emp) => {
        const ultima = ultimaEncuestaDe(emp.id, encuestas);
        return {
          nombre: emp.name || "",
          sucursal: normalizeSucursal(emp.sucursal) || "",
          puesto: emp.puesto || "",
          ultimaSemana: ultima?.semana ? formatSemanaDisplay(ultima.semana) : "Sin datos",
          scoreActual: tieneScoreValido(ultima?.score) ? Number(ultima.score) : null,
          semaforo: ultima?.semaforo || "Sin datos"
        };
      });
    const nombreSucursal = sucursalReporte === "Todas"
      ? "todas_las_sucursales"
      : sucursalReporte.toLowerCase().replace(/\s+/g, "_");
    return descargarExcel({
      nombreArchivo: `reporte_sucursal_${nombreSucursal}_${hoy()}.xlsx`,
      hoja: "Por sucursal",
      columnas: [
        { header: "Nombre", key: "nombre", width: 32 },
        { header: "Sucursal", key: "sucursal", width: 20 },
        { header: "Puesto", key: "puesto", width: 22 },
        { header: "Última semana", key: "ultimaSemana", width: 16 },
        { header: "Score actual", key: "scoreActual", width: 14, tipo: "numero" },
        { header: "Semáforo", key: "semaforo", width: 12 },
      ],
      filas,
    });
  };

  const descargarEmpleados = () => {
    const filas = empleadosActivos.map((emp) => {
      const ultima = ultimaEncuestaDe(emp.id, encuestas);
      return {
        nombre: emp.name || "",
        sucursal: normalizeSucursal(emp.sucursal) || "",
        puesto: emp.puesto || "",
        usuario: emp.user || "",
        estatus: "Activo",
        semana: ultima?.semana ? formatSemanaDisplay(ultima.semana) : "Sin datos",
        score: tieneScoreValido(ultima?.score) ? Number(ultima.score) : null,
        semaforo: ultima?.semaforo || "Sin datos"
      };
    });
    return descargarExcel({
      nombreArchivo: `empleados_mcdental_${hoy()}.xlsx`,
      hoja: "Empleados",
      columnas: [
        { header: "Nombre", key: "nombre", width: 32 },
        { header: "Sucursal", key: "sucursal", width: 20 },
        { header: "Puesto", key: "puesto", width: 22 },
        { header: "Usuario", key: "usuario", width: 18 },
        { header: "Estatus", key: "estatus", width: 12 },
        { header: "Semana", key: "semana", width: 16 },
        { header: "Score", key: "score", width: 10, tipo: "numero" },
        { header: "Semáforo", key: "semaforo", width: 12 },
      ],
      filas,
    });
  };

  /**
   * Asistencia del periodo. Las checadas se piden AL PULSAR, no al abrir la pantalla: son
   * miles de filas y quien entra a Reportes muchas veces viene por otra cosa.
   *
   * El criterio de qué es falta, retardo o periodo de prueba NO se reimplementa aquí: es el
   * mismo construirDias que pinta el calendario de Asistencia, probado en su propio test. Dos
   * copias del criterio serían dos reportes que un día dicen cosas distintas.
   */
  const descargarAsistencia = async (modo) => {
    if (!desdePeriodo || !hastaPeriodo) return;
    setBajando(true);
    try {
      const checadas = await getAsistencias({ desde: desdePeriodo, hasta: hastaPeriodo });
      const porEmpleado = empleadosActivos.map((u) => {
        const dias = construirDias({
          desde: desdePeriodo,
          hasta: hastaPeriodo,
          checadas: checadas.filter((c) => c.empleadoId === u.id),
          horarios: horarios.filter((h) => h.empleadoId === u.id),
          permisos: permisos.filter((p) => p.empleadoId === u.id),
          vacaciones: vacaciones.filter((v) => v.empleadoId === u.id),
          fechaIngreso: u.fechaIngreso,
        });
        return { empleado: u, dias, resumen: resumirDias(dias) };
      });

      if (modo === "detalle") {
        const filas = porEmpleado.flatMap(({ empleado, dias }) =>
          dias.map((d) => ({
            nombre: empleado.name || "",
            sucursal: normalizeSucursal(empleado.sucursal) || "",
            fecha: d.fecha,
            estado: ETIQUETA_ESTADO[d.estado] || d.estado,
            entrada: d.entrada?.marcadaEn || "",
            salida: d.salida?.marcadaEn || "",
            horas: d.minutosTrabajados ? Number((d.minutosTrabajados / 60).toFixed(1)) : null,
            minutosRetardo: d.minutosRetardo || null,
            justificacion: d.justificacion?.motivo || "",
          })),
        );
        return await descargarExcel({
          nombreArchivo: `asistencia_detalle_${tipoPeriodo}_${sufijo}.xlsx`,
          hoja: "Detalle por día",
          columnas: [
            { header: "Nombre", key: "nombre", width: 32 },
            { header: "Sucursal", key: "sucursal", width: 20 },
            { header: "Fecha", key: "fecha", width: 14 },
            { header: "Estado", key: "estado", width: 20 },
            { header: "Entrada", key: "entrada", width: 24 },
            { header: "Salida", key: "salida", width: 24 },
            { header: "Horas", key: "horas", width: 10, tipo: "decimal" },
            { header: "Minutos de retardo", key: "minutosRetardo", width: 18, tipo: "numero" },
            { header: "Justificación", key: "justificacion", width: 30 },
          ],
          filas,
        });
      }

      const filas = porEmpleado.map(({ empleado, resumen: r }) => ({
        nombre: empleado.name || "",
        sucursal: normalizeSucursal(empleado.sucursal) || "",
        puesto: empleado.puesto || "",
        presentes: r.presentes,
        retardos: r.retardos,
        faltas: r.faltas,
        justificados: r.justificados,
        prueba: r.prueba,
        horas: Number((r.minutosTrabajados / 60).toFixed(1)),
        puntualidad: r.puntualidad,
      }));
      return await descargarExcel({
        nombreArchivo: `asistencia_resumen_${tipoPeriodo}_${sufijo}.xlsx`,
        hoja: "Asistencia",
        columnas: [
          { header: "Nombre", key: "nombre", width: 32 },
          { header: "Sucursal", key: "sucursal", width: 20 },
          { header: "Puesto", key: "puesto", width: 22 },
          { header: "Presentes", key: "presentes", width: 12, tipo: "numero" },
          { header: "Retardos", key: "retardos", width: 12, tipo: "numero" },
          { header: "Faltas", key: "faltas", width: 10, tipo: "numero" },
          { header: "Justificados", key: "justificados", width: 14, tipo: "numero" },
          { header: "Periodo de prueba", key: "prueba", width: 18, tipo: "numero" },
          { header: "Horas trabajadas", key: "horas", width: 18, tipo: "decimal" },
          { header: "Puntualidad %", key: "puntualidad", width: 15, tipo: "numero" },
        ],
        filas,
      });
    } catch (err) {
      console.error("Error generando el reporte de asistencia:", err);
      throw err;
    } finally {
      setBajando(false);
    }
  };

  // Vacaciones y permisos juntos: para RH son la misma pregunta -quién no va a estar y por
  // qué-, y tenerlos en dos hojas obligaba a cruzarlos a mano.
  const descargarAusencias = () => {
    const filas = [
      ...vacaciones.filter((v) => tocaPeriodo(v.fechaInicio, v.fechaFin)).map((v) => ({
        tipo: "Vacaciones",
        nombre: v.empleado || "",
        sucursal: normalizeSucursal(v.sucursal) || "",
        puesto: v.puesto || "",
        desde: v.fechaInicio || "",
        hasta: v.fechaFin || "",
        dias: v.dias ?? null,
        motivo: v.motivo || "",
        estado: v.estado || "",
      })),
      ...permisos.filter((p) => tocaPeriodo(p.fecha, p.fechaFin)).map((p) => ({
        tipo: "Permiso",
        nombre: p.empleado || "",
        sucursal: normalizeSucursal(p.sucursal) || "",
        puesto: p.puesto || "",
        desde: p.fecha || "",
        hasta: p.fechaFin || p.fecha || "",
        dias: null,
        motivo: [p.causa, p.motivo].filter(Boolean).join(" · "),
        estado: p.estado || "",
      })),
    ].sort((a, b) => String(a.desde).localeCompare(String(b.desde)));

    return descargarExcel({
      nombreArchivo: `ausencias_${tipoPeriodo}_${sufijo}.xlsx`,
      hoja: "Vacaciones y permisos",
      columnas: [
        { header: "Tipo", key: "tipo", width: 14 },
        { header: "Nombre", key: "nombre", width: 32 },
        { header: "Sucursal", key: "sucursal", width: 20 },
        { header: "Puesto", key: "puesto", width: 22 },
        { header: "Desde", key: "desde", width: 14 },
        { header: "Hasta", key: "hasta", width: 14 },
        { header: "Días", key: "dias", width: 10, tipo: "numero" },
        { header: "Motivo", key: "motivo", width: 40 },
        { header: "Estado", key: "estado", width: 14 },
      ],
      filas,
    });
  };

  const descargarDescuentos = () => {
    const filas = descuentos
      .filter((d) => tocaPeriodo(d.fecha, d.fecha))
      .map((d) => ({
        nombre: d.empleado || "",
        sucursal: normalizeSucursal(d.sucursal) || "",
        puesto: d.puesto || "",
        fecha: d.fecha || "",
        tipo: d.tipo || "",
        motivo: d.motivo || "",
        monto: Number(d.monto),
        estado: d.estado || "",
        responsable: d.responsable || "",
      }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    return descargarExcel({
      nombreArchivo: `descuentos_${tipoPeriodo}_${sufijo}.xlsx`,
      hoja: "Descuentos",
      columnas: [
        { header: "Nombre", key: "nombre", width: 32 },
        { header: "Sucursal", key: "sucursal", width: 20 },
        { header: "Puesto", key: "puesto", width: 22 },
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Tipo", key: "tipo", width: 18 },
        { header: "Motivo", key: "motivo", width: 40 },
        { header: "Monto", key: "monto", width: 14, tipo: "decimal" },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Responsable", key: "responsable", width: 26 },
      ],
      filas,
    });
  };

  const OPCIONES = {
    asistencia: [
      {
        icon: "clock",
        title: "Resumen por persona",
        desc: "Excel · presentes, retardos, faltas, horas y puntualidad",
        action: () => descargarAsistencia("resumen"),
      },
      {
        icon: "file",
        title: "Detalle por día",
        desc: "Excel · un renglón por día, con entrada y salida",
        action: () => descargarAsistencia("detalle"),
      },
    ],
    bienestar: [
      {
        icon: "file",
        title: "Detalle del periodo",
        desc: `Excel · una fila por encuesta · ${encuestasDelPeriodo.length} en ${periodo?.etiqueta || "—"}`,
        action: descargarDetalle,
      },
      {
        icon: "chart",
        title: "Consolidado del periodo",
        desc: `Excel · una fila por persona · ${empleadosActivos.length} en plantilla`,
        action: descargarConsolidado,
      },
      {
        icon: "building",
        title: "Por Sucursal",
        desc: "Excel · foto actual, filtrada por ubicación",
        action: () => setMostrarSelectorSucursal(!mostrarSelectorSucursal),
        toggle: true,
      },
      {
        icon: "users",
        title: "Directorio de Empleados",
        desc: "Excel · foto actual con score y semáforo",
        action: descargarEmpleados,
      },
    ],
    ausencias: [
      {
        icon: "vacation",
        title: "Vacaciones y permisos",
        desc: "Excel · quién no estuvo, cuándo y por qué",
        action: descargarAusencias,
      },
      {
        icon: "dollar",
        title: "Descuentos",
        desc: "Excel · monto, motivo y estado",
        action: descargarDescuentos,
      },
    ],
  };

  const exportOptions = OPCIONES[tipoReporte] || [];

  return (
    <div className="admin-page">
      <PageHeader
        icon="report"
        title="Reportes"
        subtitle="Centro de exportación ejecutiva · bienestar, participación y desempeño por periodo."
      />

      <Card className="reportes-hero">
        <div className="reportes-hero-top">
          <div className="reportes-hero-icon"><Icon name="spreadsheet" size={28} /></div>
          <div>
            <h2 className="reportes-hero-heading">Exportar reportes</h2>
            <p className="reportes-hero-lead">
              Elige qué reporte y de qué periodo. Puedes sacar el actual o cualquier anterior.
            </p>
          </div>
        </div>

        <div className="reportes-periodo-panel">
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="rep-que">¿Qué reporte?</label>
            <select
              id="rep-que"
              className="mc-form-select"
              value={tipoReporte}
              onChange={(e) => { setTipoReporte(e.target.value); setPeriodoElegido(null); setMostrarSelectorSucursal(false); }}
            >
              {TIPOS_REPORTE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="mc-form-row-2">
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="rep-tipo">Agrupar por</label>
              <select
                id="rep-tipo"
                className="mc-form-select"
                value={tipoPeriodo}
                onChange={(e) => { setTipoPeriodo(e.target.value); setPeriodoElegido(null); }}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label} · {t.pista}</option>
                ))}
              </select>
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="rep-periodo">
                {tipoActual?.label || "Periodo"}
              </label>
              <select
                id="rep-periodo"
                className="mc-form-select"
                value={periodo?.id || ""}
                onChange={(e) => setPeriodoElegido(e.target.value)}
              >
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>{p.etiqueta}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="admin-info-box">
          {!periodo
            ? "Todavía no hay nada que exportar en este periodo."
            : tipoReporte === "bienestar"
              ? `${periodo.etiqueta}: ${encuestasDelPeriodo.length} encuesta(s) de ${empleadosActivos.length} personas en plantilla.`
              : `${periodo.etiqueta}: del ${desdePeriodo} al ${hastaPeriodo}.`}
          {bajando && " · Generando el archivo…"}
        </div>

        {mostrarSelectorSucursal && tipoReporte === "bienestar" && (
          <div className="reportes-sucursal-panel">
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="rep-sucursal">Selecciona la sucursal</label>
              <select id="rep-sucursal" className="mc-form-select" value={sucursalReporte} onChange={(e) => setSucursalReporte(e.target.value)}>
                {sucursalesReporte.map((sucursal) => (
                  <option key={sucursal} value={sucursal}>{sucursal}</option>
                ))}
              </select>
            </div>
            <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={descargarReporteSucursal}>
              <Icon name="spreadsheet" size={16} /> Descargar reporte de sucursal
            </button>
          </div>
        )}

        <div className="reportes-export-grid">
          {exportOptions.map((opt) => (
            <button
              key={opt.title}
              type="button"
              className={`reportes-export-btn${opt.toggle && mostrarSelectorSucursal ? " reportes-export-btn--active" : ""}`}
              onClick={opt.action}
            >
              <span className="reportes-export-btn-icon"><Icon name={opt.icon} size={22} /></span>
              <span className="reportes-export-btn-body">
                <span className="reportes-export-btn-title">{opt.title}</span>
                <span className="reportes-export-btn-desc">{opt.desc}</span>
              </span>
              <Icon name="spreadsheet" size={16} className="reportes-export-btn-arrow" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Reportes;
