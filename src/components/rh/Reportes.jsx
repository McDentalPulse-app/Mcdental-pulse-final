import React, { useState } from "react";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import { semanaActual, normalizeSucursal, sucursalMatches, isSemanaActual, formatSemanaDisplay } from "../../utils/constants";
import { esEmpleadoActivo } from "../../utils/helpers";
import { tieneScoreValido } from "../../utils/pulseScore";
import { readRiesgoRenuncia, readProblemaPersonal, getComentarioAbierto } from "../../utils/encuestaDetail";
import { descargarExcel } from "../../utils/exportarExcel";

// Los cuatro reportes salían como CSV con todo entrecomillado aunque las tarjetas dijeran
// "Excel": el score y los promedios llegaban como texto y no se podían sumar ni graficar sin
// rehacer el archivo a mano. Ahora son .xlsx de verdad (ver utils/exportarExcel.js), y las
// columnas numéricas van como número — cuando no hay dato, la celda queda vacía en vez de
// llevar el texto "Sin datos", que es lo que rompía cualquier fórmula sobre la columna.
const hoy = () => new Date().toISOString().slice(0, 10);

const Reportes = ({ users = [], encuestas = [], preguntas = [] }) => {
  const [sucursalReporte, setSucursalReporte] = useState("Todas");
  const [mostrarSelectorSucursal, setMostrarSelectorSucursal] = useState(false);
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

  const ultimaEncuestaDe = (empleadoId) =>
    encuestas
      .filter((e) => e.empleadoId === empleadoId && tieneScoreValido(e.score))
      .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")))[0];

  const descargarEmpleados = () => {
    const filas = users.filter(esEmpleadoActivo).map((emp) => {
      const ultima = ultimaEncuestaDe(emp.id);
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

  const descargarReporteMensual = () => {
    const mesActual = new Date().toISOString().slice(0, 7);
    const encuestasDelMes = encuestas.filter((e) => String(e.fecha || "").startsWith(mesActual));
    const filas = users.filter(esEmpleadoActivo).map((emp) => {
      const suyas = encuestasDelMes
        .filter((e) => e.empleadoId === emp.id && tieneScoreValido(e.score))
        .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")));
      const ultima = suyas[0];
      return {
        nombre: emp.name || "",
        sucursal: normalizeSucursal(emp.sucursal) || "",
        puesto: emp.puesto || "",
        encuestasContestadas: suyas.length,
        ultimaSemana: ultima?.semana ? formatSemanaDisplay(ultima.semana) : "Sin datos",
        scorePromedioMes: suyas.length
          ? Math.round(suyas.reduce((sum, e) => sum + Number(e.score), 0) / suyas.length)
          : null,
        scoreActual: tieneScoreValido(ultima?.score) ? Number(ultima.score) : null,
        semaforo: ultima?.semaforo || "Sin datos"
      };
    });
    return descargarExcel({
      nombreArchivo: `reporte_mensual_mcdental_${mesActual}.xlsx`,
      hoja: "Mensual",
      columnas: [
        { header: "Nombre", key: "nombre", width: 32 },
        { header: "Sucursal", key: "sucursal", width: 20 },
        { header: "Puesto", key: "puesto", width: 22 },
        { header: "Encuestas contestadas", key: "encuestasContestadas", width: 22, tipo: "numero" },
        { header: "Última semana", key: "ultimaSemana", width: 16 },
        { header: "Score promedio mes", key: "scorePromedioMes", width: 20, tipo: "numero" },
        { header: "Score actual", key: "scoreActual", width: 14, tipo: "numero" },
        { header: "Semáforo", key: "semaforo", width: 12 },
      ],
      filas,
    });
  };

  const descargarReporteSucursal = () => {
    const filas = users
      .filter(esEmpleadoActivo)
      .filter((u) => sucursalReporte === "Todas" || sucursalMatches(u.sucursal, sucursalReporte))
      .map((emp) => {
        const ultima = ultimaEncuestaDe(emp.id);
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

  const descargarReporteSemanal = () => {
    const empleados = users.filter(esEmpleadoActivo);
    const filas = encuestas
      .filter((e) => isSemanaActual(e.semana) && tieneScoreValido(e.score))
      .map((encuesta) => {
        const emp = empleados.find((e) => e.id === encuesta.empleadoId);
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
      nombreArchivo: `reporte_semanal_mcdental_${semanaActual}.xlsx`,
      hoja: "Semanal",
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

  const exportOptions = [
    {
      icon: "file",
      title: "Reporte Semanal",
      desc: "Excel · bienestar de la semana activa",
      action: descargarReporteSemanal,
    },
    {
      icon: "chart",
      title: "Reporte Mensual",
      desc: "Excel · consolidado del mes en curso",
      action: descargarReporteMensual,
    },
    {
      icon: "building",
      title: "Por Sucursal",
      desc: "Excel · filtrar y descargar por ubicación",
      action: () => setMostrarSelectorSucursal(!mostrarSelectorSucursal),
      toggle: true,
    },
    {
      icon: "users",
      title: "Directorio de Empleados",
      desc: "Excel · listado con score y semáforo",
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
              Descarga archivos con los datos actuales del sistema listos para revisión directiva.
            </p>
          </div>
        </div>

        <div className="admin-info-box">
          Incluye encuestas, Pulse Score, semáforos, sucursales y participación del periodo activo.
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
