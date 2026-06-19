import React, { useState } from "react";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import MiniBar from "../common/MiniBar";
import LineChart from "../common/LineChart";
import Avatar from "../ui/Avatar";
import { SUCURSALES } from "../../utils/constants";

import { semanaActual } from "../../utils/constants";
const Reportes = ({ users = [], encuestas = [] }) => {
  const generarReporte = (tipo) => {
    alert(`${tipo} generado correctamente en modo demo. Cuando conectemos Firebase, aquí se descargará el archivo real.`);
  };
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

  const encabezados = [
    "Nombre",
    "Sucursal",
    "Puesto",
    "Usuario",
    "Estatus",
    "Semana",
    "Score",
    "Semaforo"
  ];

  const contenido = [
    encabezados.join(","),
    ...filas.map((fila) =>
      [
        fila.nombre,
        fila.sucursal,
        fila.puesto,
        fila.usuario,
        fila.estatus,
        fila.semana,
        fila.score,
        fila.semaforo
      ].map(limpiarCSV).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8;"
  });

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

  const encuestasDelMes = encuestas.filter((e) =>
    String(e.fecha || "").startsWith(mesActual)
  );

  const getEncuestasEmpleado = (empleadoId) => {
    return encuestasDelMes
      .filter((e) => e.empleadoId === empleadoId && Number.isFinite(Number(e.score)))
      .sort((a, b) => String(b.semana || "").localeCompare(String(a.semana || "")));
  };

  const filas = empleados.map((emp) => {
    const encEmpleado = getEncuestasEmpleado(emp.id);
    const ultima = encEmpleado[0];

    const promedio = encEmpleado.length
      ? Math.round(
          encEmpleado.reduce((sum, e) => sum + Number(e.score), 0) /
            encEmpleado.length
        )
      : "Sin datos";

    return {
      nombre: emp.name || "",
      sucursal: emp.sucursal || "",
      puesto: emp.puesto || "",
      encuestasContestadas: encEmpleado.length,
      ultimaSemana: ultima?.semana || "Sin datos",
      scorePromedioMes: promedio,
      scoreActual: Number.isFinite(Number(ultima?.score)) ? Number(ultima.score) : "Sin datos",
      semaforo: ultima?.semaforo || "Sin datos"
    };
  });

  const encabezados = [
    "Nombre",
    "Sucursal",
    "Puesto",
    "Encuestas contestadas",
    "Ultima semana",
    "Score promedio mes",
    "Score actual",
    "Semaforo"
  ];

  const contenido = [
    encabezados.join(","),
    ...filas.map((fila) =>
      [
        fila.nombre,
        fila.sucursal,
        fila.puesto,
        fila.encuestasContestadas,
        fila.ultimaSemana,
        fila.scorePromedioMes,
        fila.scoreActual,
        fila.semaforo
      ].map(limpiarCSV).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte_mensual_mcdental_${mesActual}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

  const btnStyle = {
    background: "#ecfdf5",
    color: "#00796B",
    border: "1px solid #86efac",
    padding: "12px 18px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer"
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
      nombre: emp.name || "",
      sucursal: emp.sucursal || "",
      puesto: emp.puesto || "",
      ultimaSemana: ultima?.semana || "Sin datos",
      scoreActual: Number.isFinite(Number(ultima?.score)) ? Number(ultima.score) : "Sin datos",
      semaforo: ultima?.semaforo || "Sin datos"
    };
  });

  const encabezados = [
    "Nombre",
    "Sucursal",
    "Puesto",
    "Ultima semana",
    "Score actual",
    "Semaforo"
  ];

  const contenido = [
    encabezados.join(","),
    ...filas.map((fila) =>
      [
        fila.nombre,
        fila.sucursal,
        fila.puesto,
        fila.ultimaSemana,
        fila.scoreActual,
        fila.semaforo
      ].map(limpiarCSV).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8;"
  });

  const nombreSucursal =
    sucursalReporte === "Todas"
      ? "todas_las_sucursales"
      : sucursalReporte.toLowerCase().replace(/\s+/g, "_");

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

  const getEmpleado = (empleadoId) => {
    return empleados.find((emp) => emp.id === empleadoId);
  };

  const filas = encuestasSemana.map((encuesta) => {
    const emp = getEmpleado(encuesta.empleadoId);

    return {
      nombre: emp?.name || "Empleado no encontrado",
      sucursal: emp?.sucursal || "Sin sucursal",
      puesto: emp?.puesto || "Sin puesto",
      semana: encuesta.semana || "",
      fecha: encuesta.fecha || "",
      score: encuesta.score,
      semaforo: encuesta.semaforo || "Sin datos",
      riesgoRenuncia: encuesta.respuestas?.[9] || encuesta.respuestas?.p9 || "",
      problemaPersonal: encuesta.respuestas?.[7] || encuesta.respuestas?.p7 || "",
      comentario: encuesta.respuestas?.[10] || encuesta.respuestas?.p10 || ""
    };
  });

  const encabezados = [
    "Nombre",
    "Sucursal",
    "Puesto",
    "Semana",
    "Fecha",
    "Score",
    "Semaforo",
    "Riesgo renuncia",
    "Problema personal",
    "Comentario"
  ];

  const contenido = [
    encabezados.join(","),
    ...filas.map((fila) =>
      [
        fila.nombre,
        fila.sucursal,
        fila.puesto,
        fila.semana,
        fila.fecha,
        fila.score,
        fila.semaforo,
        fila.riesgoRenuncia,
        fila.problemaPersonal,
        fila.comentario
      ].map(limpiarCSV).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte_semanal_mcdental_${semanaActual}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800, color: "#004D40", textAlign: "center" }}>
        📈 Reportes
      </h2>

      <Card style={{ textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>

        <h3 style={{ margin: "0 0 10px", color: "#004D40" }}>
          Exportar Reportes
        </h3>

        <p style={{ color: "#64748b", marginBottom: 0 }}>
          Reportes de bienestar por sucursal, empleado, semana o mes.
        </p>

        <div style={{
          margin: "16px auto 22px",
          maxWidth: 620,
          padding: 14,
          borderRadius: 14,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          color: "#64748b",
          fontSize: 13,
          lineHeight: 1.6
        }}>
          Los reportes se descargan con los datos actuales del sistema: encuestas, Pulse Score,
semáforos, sucursales y participación.
        </div>
{mostrarSelectorSucursal && (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontWeight: 800, color: "#004D40", marginBottom: 8 }}>
      Selecciona la sucursal
    </label>

    <select
      value={sucursalReporte}
      onChange={(e) => setSucursalReporte(e.target.value)}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #86efac",
        minWidth: 260,
        fontWeight: 700,
        color: "#004D40",
        marginBottom: 10
      }}
    >
      {sucursalesReporte.map((sucursal) => (
        <option key={sucursal} value={sucursal}>
          {sucursal}
        </option>
      ))}
    </select>

    <div>
      <button onClick={descargarReporteSucursalExcel} style={btnStyle}>
        Descargar reporte de sucursal
      </button>
    </div>
  </div>
)}
        <div style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center"
        }}>
          <button onClick={descargarReporteSemanalExcel} style={btnStyle}>
  📄 Reporte Semanal Excel
</button>

          <button onClick={descargarReporteMensualExcel} style={btnStyle}>
  📊 Reporte Mensual Excel
</button>

          <button onClick={() => setMostrarSelectorSucursal(!mostrarSelectorSucursal)} style={btnStyle}>
  🏢 Por Sucursal Excel
</button>

          <button onClick={descargarEmpleadosCSV} style={btnStyle}>
  👥 Empleados Excel
</button>
        </div>
      </Card>
    </div>
  );
};


export default Reportes;
