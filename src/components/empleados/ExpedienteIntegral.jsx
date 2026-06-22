import React, { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
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
      <div className="admin-page">
        <p className="admin-empty">No hay empleados registrados.</p>
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
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Expediente Integral</h1>
        <p className="admin-page-subtitle">
          Vista consolidada del colaborador: bienestar, administración, comunicación y reconocimientos.
        </p>
      </div>

      <Card>
        <div className="expediente-filters">
          <div className="mc-form-group">
            <label className="mc-form-label">Filtrar por sucursal</label>
            <select
              className="mc-form-select"
              value={filtroSucursalExp}
              onChange={(e) => {
                const nuevaSucursal = e.target.value;
                setFiltroSucursalExp(nuevaSucursal);
                const lista = empleados.filter(emp =>
                  nuevaSucursal === "Todas" || emp.sucursal === nuevaSucursal
                );
                setEmpleadoId(lista[0]?.id || "");
              }}
            >
              <option value="Todas">Todas las sucursales</option>
              {[...new Set(empleados.map(emp => emp.sucursal))].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label">Seleccionar empleado</label>
            <select
              className="mc-form-select"
              value={empleado?.id || ""}
              onChange={(e) => setEmpleadoId(e.target.value)}
            >
              {empleadosFiltrados.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} · {emp.sucursal} · {emp.puesto}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="list-filter-count">
          Mostrando {empleadosFiltrados.length} de {empleados.length} empleados
        </div>
      </Card>

      <div className="admin-stat-grid">
        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap"><Icon name="user" size={20} /></div>
          <div className="admin-stat-value admin-stat-value--green" style={{ fontSize: 20 }}>{empleado.name}</div>
          <div className="admin-stat-label">{empleado.puesto}</div>
          <div className="admin-stat-label">{empleado.sucursal}</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap"><Icon name="heart" size={20} /></div>
          <div className="admin-stat-value admin-stat-value--aqua">{ultimoScore}</div>
          <div className="admin-stat-label">Pulse Score™</div>
          <div style={{ color: pulseStatus.color, fontWeight: 800, fontSize: 13, marginTop: 4 }}>{pulseStatus.label}</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap"><Icon name="stable" size={20} /></div>
          <div className="admin-stat-value" style={{ color: semaforoColor, fontSize: 24 }}>{semaforo}</div>
          <div className="admin-stat-label">Semáforo actual</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap"><Icon name="award" size={20} /></div>
          <div className="admin-stat-value admin-stat-value--blue">{reconocimientosEmpleado.length}</div>
          <div className="admin-stat-label">Reconocimientos</div>
        </Card>
      </div>

      <div className="expediente-data-grid">
        <Card>
          <SectionTitle icon="pin">Datos generales</SectionTitle>
          <div className="expediente-data-row">
            <div><b>Nombre:</b> {empleado.name}</div>
            <div><b>Puesto:</b> {empleado.puesto}</div>
            <div><b>Sucursal:</b> {empleado.sucursal}</div>
            <div><b>Antigüedad:</b> {empleado.antiguedad || "No registrada"}</div>
            <div><b>Teléfono:</b> {empleado.telefono || "No registrado"}</div>
            <div><b>Estatus:</b> Activo</div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon="heart">Bienestar</SectionTitle>
          <div className="expediente-data-row">
            <div><b>Encuestas registradas:</b> {encuestasEmpleado.length}</div>
            <div><b>Score actual:</b> {ultimoScore}</div>
            <div><b>Semáforo:</b> <span style={{ color: semaforoColor, fontWeight: 900 }}>{semaforo}</span></div>
            {esPsicologa && (
              <div><b>Notas psicológicas (Propias):</b> {notasEmpleado.length}</div>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon="paperclip">Archivos del expediente</SectionTitle>
          <button className="mc-btn-primary" style={{ marginBottom: 12 }} onClick={() => setMostrarSubirArchivo(!mostrarSubirArchivo)}>
            {mostrarSubirArchivo ? "Cancelar" : "+ Subir archivo"}
          </button>
          {mostrarSubirArchivo && (
            <div className="mc-form-grid" style={{ marginBottom: 12 }}>
              <select className="mc-form-select" value={tipoArchivoExpediente} onChange={(e) => setTipoArchivoExpediente(e.target.value)}>
                <option value="General">General</option>
                <option value="Contrato">Contrato</option>
                <option value="INE">INE</option>
                <option value="Comprobante">Comprobante</option>
                <option value="PDF">PDF</option>
              </select>
              <input type="file" className="mc-form-input" onChange={(e) => setArchivoExpediente(e.target.files[0])} />
              {archivoExpediente && (
                <div className="mc-form-hint">Archivo seleccionado: {archivoExpediente.name}</div>
              )}
              <div className="mc-form-hint mc-form-hint--warn">
                El archivo no se subirá todavía porque Firebase Storage no está activo.
                La carga de archivos se activará cuando Firebase Storage esté habilitado.
              </div>
              <button
                className="mc-btn-primary"
                type="button"
                onClick={() => {
                  if (!archivoExpediente) {
                    alert("Por favor selecciona un archivo primero.");
                    return;
                  }
                  const continuar = window.confirm(
                    "El archivo no se subirá todavía porque Firebase Storage no está activo.\n\nLa carga de archivos se activará cuando Firebase Storage esté habilitado.\n\n¿Deseas preparar el adjunto sin subirlo?"
                  );
                  if (!continuar) return;
                  setArchivoExpediente(null);
                  setMostrarSubirArchivo(false);
                }}
              >
                Confirmar selección
              </button>
            </div>
          )}
          <div className="expediente-list-scroll">
            {archivosExpediente.filter(a => a.empleadoId === empleado.id).length === 0 ? (
              <p className="admin-list-item-meta">No hay archivos adjuntos.</p>
            ) : (
              archivosExpediente.filter(a => a.empleadoId === empleado.id).map(a => (
                <div key={a.id} className="expediente-list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <b>{a.tipoArchivo}</b>
                    <div className="admin-list-item-meta">{a.nombreArchivo}</div>
                  </div>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--mc-aqua)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                    Descargar
                  </a>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon="vacation">Vacaciones</SectionTitle>
          <div className="expediente-list-scroll">
            {vacacionesEmpleado.length === 0 ? (
              <p className="admin-list-item-meta">Sin vacaciones registradas.</p>
            ) : vacacionesEmpleado.map(v => (
              <div key={v.id} className="expediente-list-row">
                <b>{v.inicio} al {v.fin}</b>
                <div className="admin-list-item-meta">{v.dias} días · {v.estado}</div>
              </div>
            ))}
          </div>
        </Card>

        {(esAdmin || esRH) && (
          <Card>
            <SectionTitle icon="dollar">Descuentos</SectionTitle>
            <div className="expediente-list-scroll">
              {descuentosEmpleado.length === 0 ? (
                <p className="admin-list-item-meta">Sin descuentos registrados.</p>
              ) : descuentosEmpleado.map(d => (
                <div key={d.id} className="expediente-list-row">
                  <b>{d.tipo}</b>
                  <div className="admin-list-item-meta">${d.monto} · {d.estado}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <SectionTitle icon="award">Reconocimientos</SectionTitle>
          <div className="expediente-list-scroll">
            {reconocimientosEmpleado.length === 0 ? (
              <p className="admin-list-item-meta">Sin reconocimientos registrados.</p>
            ) : reconocimientosEmpleado.map(r => (
              <div key={r.id} className="expediente-list-row">
                <b>{r.categoria}</b>
                <div className="admin-list-item-meta">{r.fecha} · {r.otorgadoPor}</div>
                <div className="admin-list-item-body">{r.comentario}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon="message">Comunicación</SectionTitle>
          <div className="expediente-data-row">
            <div><b>Mensajes relacionados:</b> {mensajesEmpleado.length}</div>
            <div><b>Último contacto:</b> {mensajesEmpleado.length ? "Registrado" : "Sin mensajes"}</div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon="lock">Reportes confidenciales</SectionTitle>
          <div className="expediente-list-scroll">
            {reportesEmpleado.length === 0 ? (
              <p className="admin-list-item-meta">Sin reportes confidenciales registrados.</p>
            ) : reportesEmpleado.map(r => (
              <div key={r.id} className="expediente-list-row">
                <b>{r.tipo}</b>
                <div className="admin-list-item-meta">{r.fecha} · Urgencia {r.urgencia} · {r.estado}</div>
                <div className="admin-list-item-body">{r.descripcion}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};


export default ExpedienteIntegral;
