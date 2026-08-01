import React, { useMemo, useState } from "react";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { normalizeSucursal, sucursalMatches, formatSemanaDisplay } from "../../utils/constants";
import { esEmpleadoActivo } from "../../utils/helpers";
import { tieneScoreValido } from "../../utils/pulseScore";
import { readRiesgoRenuncia, readProblemaPersonal, getComentarioAbierto } from "../../utils/encuestaDetail";
import { descargarExcel } from "../../utils/exportarExcel";
import { periodosDisponibles, encuestaEnPeriodo } from "../../utils/periodos";

// Antes había un "Reporte Semanal" y un "Reporte Mensual", los dos clavados al periodo en
// curso: no había forma de sacar la semana pasada ni el mes pasado, y para colmo cada uno
// agrupaba con un criterio distinto. Ahora son DOS FORMAS de mirar —detalle (una fila por
// encuesta) y consolidado (una fila por persona)— y el periodo se elige aparte: semana,
// quincena o mes, el actual o cualquier anterior con datos. Qué entra en cada periodo lo
// decide utils/periodos.js, en un solo sitio y con sus motivos escritos.
const hoy = () => new Date().toISOString().slice(0, 10);

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

  const periodos = useMemo(
    () => periodosDisponibles(encuestas, tipoPeriodo),
    [encuestas, tipoPeriodo],
  );
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
    const filas = empleadosActivos.map((emp) => {
      const suyas = encuestasDelPeriodo
        .filter((e) => e.empleadoId === emp.id && tieneScoreValido(e.score))
        .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")));
      const ultima = suyas[0];
      return {
        nombre: emp.name || "",
        sucursal: normalizeSucursal(emp.sucursal) || "",
        puesto: emp.puesto || "",
        contestadas: suyas.length,
        ultimaSemana: ultima?.semana ? formatSemanaDisplay(ultima.semana) : "Sin datos",
        promedio: suyas.length
          ? Math.round(suyas.reduce((sum, e) => sum + Number(e.score), 0) / suyas.length)
          : null,
        scoreActual: tieneScoreValido(ultima?.score) ? Number(ultima.score) : null,
        semaforo: ultima?.semaforo || "Sin datos"
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

  const exportOptions = [
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
  ];

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
              Elige el periodo y descarga. Puedes sacar el actual o cualquier anterior con datos.
            </p>
          </div>
        </div>

        <div className="reportes-periodo-panel">
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
          {periodo
            ? `${periodo.etiqueta}: ${encuestasDelPeriodo.length} encuesta(s) de ${empleadosActivos.length} personas en plantilla.`
            : "Todavía no hay encuestas que exportar."}
        </div>

        {mostrarSelectorSucursal && (
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
