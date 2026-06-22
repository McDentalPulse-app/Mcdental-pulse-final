import React, { useState } from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { semanaActual } from "../../utils/constants";

const Reportes = ({ users = [], encuestas = [] }) => {
  const [sucursalReporte, setSucursalReporte] = useState("Todas");
  const [mostrarSelectorSucursal, setMostrarSelectorSucursal] = useState(false);
  const sucursalesReporte = [
    "Todas",
    ...Array.from(
      new Set(
        users
          .filter((u) => u.role === "empleado")
          .map((u) => u.sucursal)
          .filter(Boolean)
      )
    ).sort()
  ];

  const descargarEmpleadosCSV = () => {
    const empleados = users.filter((u) => u.role === "empleado");
    const limpiarCSV = (valor) => {
      const texto = String(valor ?? "").replace(/"/g, '""');
      return `"${texto}"`;
    };
    const getUltimaEncuesta = (empleadoId) => {
      return encuestas
        .filter((e) => e.empleadoId === empleadoId && Number.isFinite(Number(e.score)))
        .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")))[0];
    };
    const filas = empleados.map((emp) => {
      const ultima = getUltimaEncuesta(emp.id);
      return {
        nombre: emp.name || "",
        sucursal: emp.sucursal || "",
        puesto: emp.puesto || "",
        usuario: emp.user || "",
        estatus: "Activo",
        semana: ultima?.semana || "Sin datos",
        score: Number.isFinite(Number(ultima?.score)) ? Number(ultima.score) : "Sin datos",
        semaforo: ultima?.semaforo || "Sin datos"
      };
    });
    const encabezados = ["Nombre", "Sucursal", "Puesto", "Usuario", "Estatus", "Semana", "Score", "Semaforo"];
    const contenido = [
      encabezados.join(","),
      ...filas.map((fila) =>
        [fila.nombre, fila.sucursal, fila.puesto, fila.usuario, fila.estatus, fila.semana, fila.score, fila.semaforo]
          .map(limpiarCSV).join(",")
      )
    ].join("\n");
    const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `empleados_mcdental_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const descargarReporteMensualExcel = () => {
    const empleados = users.filter((u) => u.role === "empleado");
    const mesActual = new Date().toISOString().slice(0, 7);
    const limpiarCSV = (valor) => {
      const texto = String(valor ?? "").replace(/"/g, '""');
      return `"${texto}"`;
    };
    const encuestasDelMes = encuestas.filter((e) => String(e.fecha || "").startsWith(mesActual));
    const getEncuestasEmpleado = (empleadoId) => {
      return encuestasDelMes
        .filter((e) => e.empleadoId === empleadoId && Number.isFinite(Number(e.score)))
        .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")));
    };
    const filas = empleados.map((emp) => {
      const encEmpleado = getEncuestasEmpleado(emp.id);
      const ultima = encEmpleado[0];
      const promedio = encEmpleado.length
        ? Math.round(encEmpleado.reduce((sum, e) => sum + Number(e.score), 0) / encEmpleado.length)
        : "Sin datos";
      return {
        nombre: emp.name || "", sucursal: emp.sucursal || "", puesto: emp.puesto || "",
        encuestasContestadas: encEmpleado.length, ultimaSemana: ultima?.semana || "Sin datos",
        scorePromedioMes: promedio,
        scoreActual: Number.isFinite(Number(ultima?.score)) ? Number(ultima.score) : "Sin datos",
        semaforo: ultima?.semaforo || "Sin datos"
      };
    });
    const encabezados = ["Nombre", "Sucursal", "Puesto", "Encuestas contestadas", "Ultima semana", "Score promedio mes", "Score actual", "Semaforo"];
    const contenido = [
      encabezados.join(","),
      ...filas.map((fila) =>
        [fila.nombre, fila.sucursal, fila.puesto, fila.encuestasContestadas, fila.ultimaSemana, fila.scorePromedioMes, fila.scoreActual, fila.semaforo]
          .map(limpiarCSV).join(",")
      )
    ].join("\n");
    const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte_mensual_mcdental_${mesActual}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const descargarReporteSucursalExcel = () => {
    const empleados = users
      .filter((u) => u.role === "empleado")
      .filter((u) => sucursalReporte === "Todas" || u.sucursal === sucursalReporte);
    const limpiarCSV = (valor) => {
      const texto = String(valor ?? "").replace(/"/g, '""');
      return `"${texto}"`;
    };
    const getUltimaEncuesta = (empleadoId) => {
      return encuestas
        .filter((e) => e.empleadoId === empleadoId && Number.isFinite(Number(e.score)))
        .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")))[0];
    };
    const filas = empleados.map((emp) => {
      const ultima = getUltimaEncuesta(emp.id);
      return {
        nombre: emp.name || "", sucursal: emp.sucursal || "", puesto: emp.puesto || "",
        ultimaSemana: ultima?.semana || "Sin datos",
        scoreActual: Number.isFinite(Number(ultima?.score)) ? Number(ultima.score) : "Sin datos",
        semaforo: ultima?.semaforo || "Sin datos"
      };
    });
    const encabezados = ["Nombre", "Sucursal", "Puesto", "Ultima semana", "Score actual", "Semaforo"];
    const contenido = [
      encabezados.join(","),
      ...filas.map((fila) =>
        [fila.nombre, fila.sucursal, fila.puesto, fila.ultimaSemana, fila.scoreActual, fila.semaforo]
          .map(limpiarCSV).join(",")
      )
    ].join("\n");
    const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
    const nombreSucursal = sucursalReporte === "Todas" ? "todas_las_sucursales" : sucursalReporte.toLowerCase().replace(/\s+/g, "_");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte_sucursal_${nombreSucursal}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const descargarReporteSemanalExcel = () => {
    const empleados = users.filter((u) => u.role === "empleado");
    const limpiarCSV = (valor) => {
      const texto = String(valor ?? "").replace(/"/g, '""');
      return `"${texto}"`;
    };
    const encuestasSemana = encuestas.filter(
      (e) => e.semana === semanaActual && Number.isFinite(Number(e.score))
    );
    const getEmpleado = (empleadoId) => empleados.find((emp) => emp.id === empleadoId);
    const filas = encuestasSemana.map((encuesta) => {
      const emp = getEmpleado(encuesta.empleadoId);
      return {
        nombre: emp?.name || "Empleado no encontrado", sucursal: emp?.sucursal || "Sin sucursal",
        puesto: emp?.puesto || "Sin puesto", semana: encuesta.semana || "", fecha: encuesta.fecha || "",
        score: encuesta.score, semaforo: encuesta.semaforo || "Sin datos",
        riesgoRenuncia: encuesta.respuestas?.[9] || encuesta.respuestas?.p9 || "",
        problemaPersonal: encuesta.respuestas?.[7] || encuesta.respuestas?.p7 || "",
        comentario: encuesta.respuestas?.[10] || encuesta.respuestas?.p10 || ""
      };
    });
    const encabezados = ["Nombre", "Sucursal", "Puesto", "Semana", "Fecha", "Score", "Semaforo", "Riesgo renuncia", "Problema personal", "Comentario"];
    const contenido = [
      encabezados.join(","),
      ...filas.map((fila) =>
        [fila.nombre, fila.sucursal, fila.puesto, fila.semana, fila.fecha, fila.score, fila.semaforo, fila.riesgoRenuncia, fila.problemaPersonal, fila.comentario]
          .map(limpiarCSV).join(",")
      )
    ].join("\n");
    const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte_semanal_mcdental_${semanaActual}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportOptions = [
    {
      icon: "file",
      title: "Reporte Semanal",
      desc: "Excel · bienestar de la semana activa",
      action: descargarReporteSemanalExcel,
    },
    {
      icon: "chart",
      title: "Reporte Mensual",
      desc: "Excel · consolidado del mes en curso",
      action: descargarReporteMensualExcel,
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
      action: descargarEmpleadosCSV,
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Reportes</h1>
        <p className="admin-page-subtitle">
          Centro de exportación ejecutiva · bienestar, participación y desempeño por periodo.
        </p>
      </div>

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
              <label className="mc-form-label">Selecciona la sucursal</label>
              <select className="mc-form-select" value={sucursalReporte} onChange={(e) => setSucursalReporte(e.target.value)}>
                {sucursalesReporte.map((sucursal) => (
                  <option key={sucursal} value={sucursal}>{sucursal}</option>
                ))}
              </select>
            </div>
            <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={descargarReporteSucursalExcel}>
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
