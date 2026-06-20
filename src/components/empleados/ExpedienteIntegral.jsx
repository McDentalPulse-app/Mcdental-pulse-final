import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { SUCURSALES, semanaActual } from "../../utils/constants";

import { calcPulseScore, getPulseStatus } from "../../utils/pulseScore";

const ExpedienteIntegral = ({
  users,
  encuestas,
  mensajes,
  notas,
  vacaciones,
  permisos,
  descuentos,
  reconocimientos,
  reportesConfidenciales,
  currentUser,
  archivosExpediente = [],
  onSubirArchivoExpediente
}) => {
  const { usuarios: USERS } = useGlobal();

 const empleados = users.filter(u => u.role === "empleado");
const [filtroSucursalExp, setFiltroSucursalExp] = useState("Todas");
const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || "");
const [mostrarSubirArchivo, setMostrarSubirArchivo] = useState(false);
const [archivoExpediente, setArchivoExpediente] = useState(null);
const [tipoArchivoExpediente, setTipoArchivoExpediente] = useState("General");

const empleadosFiltrados = empleados.filter(emp =>
  filtroSucursalExp === "Todas" || emp.sucursal === filtroSucursalExp
);

const empleado =
  empleadosFiltrados.find(e => e.id === Number(empleadoId)) ||
  empleadosFiltrados[0] ||
  empleados[0];

  if (!empleado) {
    return (
      <div style={{ color: "#64748b", padding: 40 }}>
        No hay empleados registrados.
      </div>
    );
  }

  const encuestasEmpleado = encuestas.filter(e => e.empleadoId === empleado.id);
  const mensajesEmpleado = mensajes.filter(m => m.de === empleado.id || m.para === empleado.id);
  const vacacionesEmpleado = vacaciones.filter(v => v.empleadoId === empleado.id);
  const permisosEmpleado = permisos.filter(p => p.empleadoId === empleado.id);
  const descuentosEmpleado = descuentos.filter(d => d.empleadoId === empleado.id);
  const reconocimientosEmpleado = reconocimientos.filter(r => r.empleadoId === empleado.id);
  const reportesEmpleado = reportesConfidenciales.filter(r => r.empleadoId === empleado.id);

  const ultimoScore = encuestasEmpleado.length
    ? encuestasEmpleado[encuestasEmpleado.length - 1].score
    : calcPulseScore(empleado.id, encuestas).score;

  const pulseStatus = getPulseStatus(ultimoScore);
  const semaforo = pulseStatus.semaforo;
  const semaforoColor = pulseStatus.color;

  const esAdmin = currentUser?.role === "admin";
  const esRH = currentUser?.role === "rh" || currentUser?.role === "recursos humanos";
  const esPsicologa = currentUser?.role === "psicologa";

  // Notas psicológicas: Solo la psicóloga que la escribió puede verla (o por nombre para notas previas)
  const notasEmpleado = notas.filter(n => 
    n.empleadoId === empleado.id && 
    esPsicologa && 
    (n.autorId === currentUser.id || n.autor === currentUser.name)
  );

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, color: "#004D40" }}>
        Expediente Integral
      </h1>
      <p style={{ margin: "0 0 24px", color: "#64748b" }}>
        Vista consolidada del colaborador: bienestar, administración, comunicación y reconocimientos.
      </p>

      <Card style={{ marginBottom: 18 }}>
  <div style={{
    display: "grid",
    gridTemplateColumns: "0.8fr 1.2fr",
    gap: 12,
    alignItems: "end"
  }}>
    <div>
      <label style={{
        display: "block",
        marginBottom: 8,
        fontWeight: 900,
        color: "#004D40",
        textAlign: "center"
      }}>
        Filtrar por sucursal
      </label>

      <select
        value={filtroSucursalExp}
        onChange={(e) => {
          const nuevaSucursal = e.target.value;
          setFiltroSucursalExp(nuevaSucursal);

          const lista = empleados.filter(emp =>
            nuevaSucursal === "Todas" || emp.sucursal === nuevaSucursal
          );

          setEmpleadoId(lista[0]?.id || "");
        }}
        style={{
          width: "100%",
          padding: "13px 14px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          color: "#0f172a",
          fontSize: 14,
          fontWeight: 800,
          outline: "none"
        }}
      >
        <option value="Todas">Todas las sucursales</option>
        {[...new Set(empleados.map(emp => emp.sucursal))].map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>

    <div>
      <label style={{
        display: "block",
        marginBottom: 8,
        fontWeight: 900,
        color: "#004D40",
        textAlign: "center"
      }}>
        Seleccionar empleado
      </label>

      <select
        value={empleado?.id || ""}
        onChange={(e) => setEmpleadoId(e.target.value)}
        style={{
          width: "100%",
          padding: "13px 14px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: "#3b3b3b",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 800,
          outline: "none"
        }}
      >
        {empleadosFiltrados.map(emp => (
          <option key={emp.id} value={emp.id}>
            {emp.name} · {emp.sucursal} · {emp.puesto}
          </option>
        ))}
      </select>
    </div>
  </div>

  <div style={{
    marginTop: 12,
    color: "#64748b",
    textAlign: "center",
    fontSize: 13,
    fontWeight: 700
  }}>
    Mostrando {empleadosFiltrados.length} de {empleados.length} empleados
  </div>
</Card>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        margin: "18px 0 22px"
      }}>
        <Card>
          <div style={{ fontSize: 24 }}>👤</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#004D40" }}>
            {empleado.name}
          </div>
          <div style={{ color: "#64748b" }}>{empleado.puesto}</div>
          <div style={{ color: "#64748b" }}>{empleado.sucursal}</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>💓</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#00897B" }}>
            {ultimoScore}
          </div>
          <div style={{ fontWeight: 700 }}>Pulse Score™</div>
          <div style={{ fontWeight: 700 }}>Pulse Score™</div>
<div style={{ color: pulseStatus.color, fontWeight: 800, fontSize: 13 }}>
  {pulseStatus.label}
</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>🚦</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: semaforoColor }}>
            {semaforo}
          </div>
          <div style={{ fontWeight: 700 }}>Semáforo actual</div>
        </Card>

        <Card>
          <div style={{ fontSize: 24 }}>🏅</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#2563eb" }}>
            {reconocimientosEmpleado.length}
          </div>
          <div style={{ fontWeight: 700 }}>Reconocimientos</div>
        </Card>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: 16
      }}>
        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>📌 Datos generales</h3>
          <div style={{ color: "#334155", lineHeight: 1.8 }}>
            <div><b>Nombre:</b> {empleado.name}</div>
            <div><b>Puesto:</b> {empleado.puesto}</div>
            <div><b>Sucursal:</b> {empleado.sucursal}</div>
            <div><b>Antigüedad:</b> {empleado.antiguedad || "No registrada"}</div>
            <div><b>Teléfono:</b> {empleado.telefono || "No registrado"}</div>
            <div><b>Estatus:</b> Activo</div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>💓 Bienestar</h3>
          <div style={{ color: "#334155", lineHeight: 1.8 }}>
            <div><b>Encuestas registradas:</b> {encuestasEmpleado.length}</div>
            <div><b>Score actual:</b> {ultimoScore}</div>
            <div><b>Semáforo:</b> <span style={{ color: semaforoColor, fontWeight: 900 }}>{semaforo}</span></div>
            {esPsicologa && (
              <div><b>Notas psicológicas (Propias):</b> {notasEmpleado.length}</div>
            )}
          </div>
        </Card>

        <Card>
  <h3 style={{ marginTop: 0, color: "#004D40" }}>📎 Archivos del expediente</h3>

  <button
    onClick={() => setMostrarSubirArchivo(!mostrarSubirArchivo)}
    style={{
      marginBottom: 12,
      padding: "9px 14px",
      border: "none",
      borderRadius: 8,
      background: "#00897B",
      color: "white",
      fontWeight: 700,
      cursor: "pointer"
    }}
  >
    {mostrarSubirArchivo ? "Cancelar" : "+ Subir archivo"}
  </button>

  {mostrarSubirArchivo && (
    <div style={{ display: "grid", gap: 8 }}>
      <select
        value={tipoArchivoExpediente}
        onChange={(e) => setTipoArchivoExpediente(e.target.value)}
      >
        <option value="General">General</option>
        <option value="Contrato">Contrato</option>
        <option value="INE">INE</option>
        <option value="Comprobante">Comprobante</option>
        <option value="PDF">PDF</option>
      </select>

      <input
        type="file"
        onChange={(e) => setArchivoExpediente(e.target.files[0])}
      />

      <button
        onClick={async () => {
          if (!archivoExpediente) {
            alert("Por favor selecciona un archivo primero.");
            return;
          }
          await onSubirArchivoExpediente({
            empleado,
            archivo: archivoExpediente,
            tipo: tipoArchivoExpediente
          });
          setArchivoExpediente(null);
          setMostrarSubirArchivo(false);
        }}
        style={{ padding: 8, background: "#004D40", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
      >
        Confirmar Subida
      </button>
    </div>
  )}

  <div style={{ marginTop: 16 }}>
    {archivosExpediente.filter(a => a.empleadoId === empleado.id).length === 0 ? (
      <p style={{ color: "#64748b", fontSize: 13 }}>No hay archivos adjuntos.</p>
    ) : (
      archivosExpediente
        .filter(a => a.empleadoId === empleado.id)
        .map(a => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
            <div>
              <b style={{ fontSize: 13 }}>{a.tipoArchivo}</b>
              <div style={{ color: "#64748b", fontSize: 12 }}>{a.nombreArchivo}</div>
            </div>
            <a 
              href={a.url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: "#00897B", textDecoration: "none", fontSize: 13, fontWeight: "bold" }}
            >
              Descargar
            </a>
          </div>
        ))
    )}
  </div>
</Card>


            <Card>
              <h3 style={{ marginTop: 0, color: "#004D40" }}>🏖️ Vacaciones</h3>
              {vacacionesEmpleado.length === 0 ? (
                <p style={{ color: "#64748b" }}>Sin vacaciones registradas.</p>
              ) : vacacionesEmpleado.map(v => (
                <div key={v.id} style={{ padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
                  <b>{v.inicio} al {v.fin}</b>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{v.dias} días · {v.estado}</div>
                </div>
              ))}
            </Card>

            {(esAdmin || esRH) && (
              <Card>
                <h3 style={{ marginTop: 0, color: "#004D40" }}>💸 Descuentos</h3>
                {descuentosEmpleado.length === 0 ? (
                  <p style={{ color: "#64748b" }}>Sin descuentos registrados.</p>
                ) : descuentosEmpleado.map(d => (
                  <div key={d.id} style={{ padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
                    <b>{d.tipo}</b>
                    <div style={{ color: "#64748b", fontSize: 13 }}>${d.monto} · {d.estado}</div>
                  </div>
                ))}
              </Card>
            )}

        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>🏅 Reconocimientos</h3>
          {reconocimientosEmpleado.length === 0 ? (
            <p style={{ color: "#64748b" }}>Sin reconocimientos registrados.</p>
          ) : reconocimientosEmpleado.map(r => (
            <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
              <b>{r.categoria}</b>
              <div style={{ color: "#64748b", fontSize: 13 }}>{r.fecha} · {r.otorgadoPor}</div>
              <div style={{ color: "#334155", fontSize: 13 }}>{r.comentario}</div>
            </div>
          ))}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>💬 Comunicación</h3>
          <div style={{ color: "#334155", lineHeight: 1.8 }}>
            <div><b>Mensajes relacionados:</b> {mensajesEmpleado.length}</div>
            <div><b>Último contacto:</b> {mensajesEmpleado.length ? "Registrado" : "Sin mensajes"}</div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0, color: "#004D40" }}>🔒 Reportes confidenciales</h3>
          {reportesEmpleado.length === 0 ? (
            <p style={{ color: "#64748b" }}>Sin reportes confidenciales registrados.</p>
          ) : reportesEmpleado.map(r => (
            <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
              <b>{r.tipo}</b>
              <div style={{ color: "#64748b", fontSize: 13 }}>{r.fecha} · Urgencia {r.urgencia} · {r.estado}</div>
              <div style={{ color: "#334155", fontSize: 13 }}>{r.descripcion}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};


export default ExpedienteIntegral;
