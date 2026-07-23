import React, { useState, useEffect } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Badge from "../common/Badge";
import KPI from "../common/KPI";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import PulseScoreBadge from "../common/PulseScoreBadge";
import { normalizeSucursal, sucursalMatches, formatSemanaDisplay } from "../../utils/constants";

import { calcPulseScore, getPulseStatus, tieneScoreValido } from "../../utils/pulseScore";
import { getSignedUrlArchivoExpediente } from "../../services/supabase/archivosExpedienteService";
import { subirAvatarUsuario, quitarAvatarUsuario } from "../../services/supabase/avatarService";
import { notify } from "../../utils/notify";
import { getEncuestasEmpleado, getEncuestaSemaforo } from "../../utils/encuestaDetail";
import EncuestaDetalleModal from "./EncuestaDetalleModal";
import {
  formatAntiguedadEmpleado,
  formatFechaCumpleanos,
  formatFechaIngreso,
  resolveFechaCumpleanos,
  resolveFechaIngreso,
} from "../../utils/helpers";
import { useNotification } from "../../contexts/NotificationContext";
import { nivelColor } from "../../config/theme";

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
  const { usuarios: USERS, encuestaPreguntas, setUsuarios } = useGlobal();
  const { toast } = useNotification();
  const [subiendoFoto, setSubiendoFoto] = useState(false);

 // A propósito INCLUYE inactivos: el expediente es archivo/historial y debe
 // seguir consultable tras la baja (los dashboards sí los excluyen).
 const empleados = users.filter(u => ["empleado", "doctor"].includes(u.role));
const [filtroSucursalExp, setFiltroSucursalExp] = useState("Todas");
const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || "");
const [mostrarSubirArchivo, setMostrarSubirArchivo] = useState(false);
const [archivoExpediente, setArchivoExpediente] = useState(null);
const [tipoArchivoExpediente, setTipoArchivoExpediente] = useState("General");
const [subiendoArchivo, setSubiendoArchivo] = useState(false);
const [encuestaDetalle, setEncuestaDetalle] = useState(null);

const empleadosFiltrados = empleados.filter(emp =>
  filtroSucursalExp === "Todas" || sucursalMatches(emp.sucursal, filtroSucursalExp)
);

const empleado =
  empleadosFiltrados.find(e => String(e.id) === String(empleadoId)) ||
  empleadosFiltrados[0] ||
  empleados[0];

  useEffect(() => {
    setEncuestaDetalle(null);
  }, [empleado?.id]);

  if (!empleado) {
    return (
      <div className="admin-page">
        <p className="admin-empty">No hay empleados registrados.</p>
      </div>
    );
  }

  const encuestasEmpleado = getEncuestasEmpleado(encuestas, empleado.id);
  const mensajesEmpleado = mensajes.filter(m => m.de === empleado.id || m.para === empleado.id);
  const vacacionesEmpleado = vacaciones.filter(v => v.empleadoId === empleado.id);
  const descuentosEmpleado = descuentos.filter(d => d.empleadoId === empleado.id);
  const reconocimientosEmpleado = reconocimientos.filter(r => r.empleadoId === empleado.id);
  const reportesEmpleado = reportesConfidenciales.filter(r => r.empleadoId === empleado.id);

  const ps = calcPulseScore(empleado.id, encuestas);
  const ultimoScore = ps.score;
  const pulseStatus = getPulseStatus(ultimoScore);
  const semaforo = pulseStatus.semaforo;
  const semaforoColor = nivelColor(pulseStatus.nivel);

  const esAdmin = currentUser?.role === "admin";
  const esRH = currentUser?.role === "rh" || currentUser?.role === "recursos humanos";
  const esPsicologa = currentUser?.role === "psicologa";
  const puedeVerEncuestas = esAdmin || esPsicologa;
  const puedeCambiarFoto = esAdmin || esPsicologa;

  const handleCambiarFoto = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const nuevaUrl = await subirAvatarUsuario(empleado.id, archivo);
      setUsuarios((prev) => prev.map((u) => (u.id === empleado.id ? { ...u, avatarUrl: nuevaUrl } : u)));
      toast.success("Foto de perfil actualizada.");
    } catch (error) {
      toast.error(error.message || "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleQuitarFoto = async () => {
    const confirmar = await notify.confirm({
      title: "Quitar foto de perfil",
      description: `¿Seguro que quieres quitar la foto de perfil de ${empleado.name}?`,
      variant: "warning",
      confirmText: "Quitar foto",
    });
    if (!confirmar) return;

    setSubiendoFoto(true);
    try {
      await quitarAvatarUsuario(empleado.id);
      setUsuarios((prev) => prev.map((u) => (u.id === empleado.id ? { ...u, avatarUrl: null } : u)));
      toast.success("Foto de perfil eliminada.");
    } catch (error) {
      toast.error(error.message || "No se pudo quitar la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  // Notas psicológicas: Solo la psicóloga que la escribió puede verla (o por nombre para notas previas)
  const notasEmpleado = notas.filter(n => 
    n.empleadoId === empleado.id && 
    esPsicologa && 
    (n.autorId === currentUser.id || n.autor === currentUser.name)
  );

  return (
    <div className="admin-page expediente-page">
      <PageHeader
        icon="folderSearch"
        title="Expediente Integral"
        subtitle="Vista consolidada del colaborador: bienestar, administración, comunicación y reconocimientos."
      />

      <Card>
        <div className="expediente-filters">
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="exp-filtro-sucursal">Filtrar por sucursal</label>
            <select
              id="exp-filtro-sucursal"
              className="mc-form-select"
              value={filtroSucursalExp}
              onChange={(e) => {
                const nuevaSucursal = e.target.value;
                setFiltroSucursalExp(nuevaSucursal);
                const lista = empleados.filter(emp =>
                  nuevaSucursal === "Todas" || sucursalMatches(emp.sucursal, nuevaSucursal)
                );
                setEmpleadoId(lista[0]?.id || "");
              }}
            >
              <option value="Todas">Todas las sucursales</option>
              {[...new Set(empleados.map((emp) => normalizeSucursal(emp.sucursal)))].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="exp-empleado">Seleccionar empleado</label>
            <select
              id="exp-empleado"
              className="mc-form-select"
              value={empleado?.id || ""}
              onChange={(e) => setEmpleadoId(e.target.value)}
            >
              {empleadosFiltrados.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} · {normalizeSucursal(emp.sucursal)} · {emp.puesto}
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
        <Card className="admin-stat-card expediente-foto-card">
          <Avatar name={empleado.name} size={48} color="var(--mc-verde)" photoUrl={empleado.avatarUrl} />
          {puedeCambiarFoto && (
            <div className="expediente-foto-actions">
              <label className="expediente-foto-upload" aria-disabled={subiendoFoto}>
                {subiendoFoto ? "..." : "Cambiar foto"}
                <input type="file" accept="image/*" hidden disabled={subiendoFoto} onChange={handleCambiarFoto} />
              </label>
              {empleado.avatarUrl && (
                <button
                  type="button"
                  className="expediente-foto-quitar"
                  disabled={subiendoFoto}
                  onClick={handleQuitarFoto}
                >
                  Quitar foto
                </button>
              )}
            </div>
          )}
          <div className="admin-stat-value admin-stat-value--green" style={{ fontSize: 20, marginTop: 8 }}>{empleado.name}</div>
          <div className="admin-stat-label">{empleado.puesto}</div>
          <div className="admin-stat-label">{normalizeSucursal(empleado.sucursal)}</div>
        </Card>
        <Card className="admin-stat-card">
          <div className="admin-stat-icon-wrap"><Icon name="heart" size={20} /></div>
          <div className="admin-stat-value admin-stat-value--aqua">{ultimoScore}</div>
          <div className="admin-stat-label">Pulse Score™</div>
          <div style={{ color: nivelColor(pulseStatus.nivel), fontWeight: 800, fontSize: 13, marginTop: 4 }}>{pulseStatus.label}</div>
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
            <div><b>Sucursal:</b> {normalizeSucursal(empleado.sucursal)}</div>
            <div><b>Fecha de ingreso:</b> {formatFechaIngreso(resolveFechaIngreso(empleado))}</div>
            <div><b>Antigüedad:</b> {formatAntiguedadEmpleado(empleado)}</div>
            <div><b>Fecha de cumpleaños:</b> {formatFechaCumpleanos(resolveFechaCumpleanos(empleado))}</div>
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

        <Card className="expediente-files-card">
          <SectionTitle icon="paperclip">Archivos del expediente</SectionTitle>
          {!mostrarSubirArchivo ? (
            <button
              type="button"
              className="mc-btn-primary mc-btn-with-icon"
              onClick={() => setMostrarSubirArchivo(true)}
            >
              <Icon name="plus" size={16} /> Subir archivo
            </button>
          ) : (
            <div className="expediente-upload-panel">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="exp-tipo-archivo">Tipo de archivo</label>
                <select id="exp-tipo-archivo" className="mc-form-select" value={tipoArchivoExpediente} onChange={(e) => setTipoArchivoExpediente(e.target.value)}>
                  <option value="General">General</option>
                  <option value="Contrato">Contrato</option>
                  <option value="INE">INE</option>
                  <option value="Comprobante">Comprobante</option>
                  <option value="PDF">PDF</option>
                </select>
              </div>

              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="exp-archivo-adjunto">Archivo adjunto</label>
                <label className="mc-file-input-wrap">
                  <span className="mc-file-input-icon"><Icon name="paperclip" size={18} /></span>
                  <span className="mc-file-input-text">
                    {archivoExpediente ? archivoExpediente.name : "Seleccionar archivo del expediente"}
                  </span>
                  <input
                    id="exp-archivo-adjunto"
                    type="file"
                    className="mc-file-input-overlay"
                    onChange={(e) => setArchivoExpediente(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="mc-form-hint">
                <Icon name="alert" size={14} />
                <span>Límite de 10 MB por archivo.</span>
              </div>

              <div className="expediente-upload-actions">
                <button
                  type="button"
                  className="mc-btn-secondary"
                  onClick={() => {
                    setMostrarSubirArchivo(false);
                    setArchivoExpediente(null);
                  }}
                >
                  Cancelar archivo
                </button>
                <button
                  className="mc-btn-primary mc-btn-with-icon"
                  type="button"
                  disabled={subiendoArchivo}
                  onClick={async () => {
                    if (!archivoExpediente) {
                      toast.warning("Por favor selecciona un archivo primero.");
                      return;
                    }
                    setSubiendoArchivo(true);
                    try {
                      await onSubirArchivoExpediente({ empleado, archivo: archivoExpediente, tipo: tipoArchivoExpediente });
                      setArchivoExpediente(null);
                      setMostrarSubirArchivo(false);
                    } finally {
                      setSubiendoArchivo(false);
                    }
                  }}
                >
                  <Icon name="paperclip" size={16} /> {subiendoArchivo ? "Subiendo..." : "Subir archivo"}
                </button>
              </div>
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
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const url = await getSignedUrlArchivoExpediente(a.rutaArchivo);
                        window.open(url, "_blank", "noopener,noreferrer");
                      } catch (error) {
                        notify.toast.error("No se pudo abrir el archivo.");
                      }
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-aqua)", fontWeight: 700, fontSize: 13 }}
                  >
                    Descargar
                  </button>
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

        {puedeVerEncuestas && (
          <Card className="expediente-encuestas-card">
            <SectionTitle icon="clipboard">Encuestas</SectionTitle>
            <div className="expediente-list-scroll">
              {encuestasEmpleado.length === 0 ? (
                <p className="admin-list-item-meta">Sin encuestas registradas.</p>
              ) : (
                encuestasEmpleado.map((enc) => {
                  const sem = getEncuestaSemaforo(enc);
                  const encScore = tieneScoreValido(enc.score) ? Number(enc.score) : "—";
                  return (
                    <div key={`${enc.empleadoId}-${enc.semana}-${enc.fecha || ""}`} className="expediente-encuesta-row">
                      <div className="expediente-encuesta-main">
                        <div className="expediente-encuesta-week">
                          {formatSemanaDisplay(enc.semana) || "Semana sin registro"}
                          {enc.fecha ? <span className="expediente-encuesta-date"> · {enc.fecha}</span> : null}
                        </div>
                        <div className="expediente-encuesta-meta">
                          <span><b>Pulse Score:</b> {encScore}</span>
                          <span className="expediente-encuesta-semaforo">
                            <Badge tipo={sem} />
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mc-btn-outline mc-btn-with-icon expediente-encuesta-btn"
                        onClick={() => setEncuestaDetalle(enc)}
                      >
                        <Icon name="eye" size={15} /> Ver detalles
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        )}

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

      {encuestaDetalle && (
        <EncuestaDetalleModal
          encuesta={encuestaDetalle}
          empleado={empleado}
          preguntas={encuestaPreguntas}
          onClose={() => setEncuestaDetalle(null)}
        />
      )}
    </div>
  );
};


export default ExpedienteIntegral;
