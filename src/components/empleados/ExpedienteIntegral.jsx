import React, { useState, useEffect } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import Badge from "../common/Badge";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import Tabs from "../common/Tabs";
import Icon from "../ui/Icon";
import Medalla from "../ui/Medalla";
import { getMedalla } from "../../config/medallas";
import Avatar from "../ui/Avatar";
import { normalizeSucursal, formatSemanaDisplay } from "../../utils/constants";

import { calcPulseScore, getPulseStatus, tieneScoreValido } from "../../utils/pulseScore";
import { filtrarEmpleadosExpediente, estatusEmpleado } from "../../utils/expediente";
import { getSignedUrlArchivoExpediente } from "../../services/supabase/archivosExpedienteService";
import { subirAvatarUsuario, quitarAvatarUsuario } from "../../services/supabase/avatarService";
import { notify } from "../../utils/notify";
import { getEncuestasEmpleado, getEncuestaSemaforo } from "../../utils/encuestaDetail";
import EncuestaDetalleModal from "./EncuestaDetalleModal";
import {
  formatAntiguedadEmpleado,
  formatFechaCumpleanos,
  formatFechaIngreso,
  formatFechaSolicitud,
  resolveFechaCumpleanos,
  resolveFechaIngreso,
} from "../../utils/helpers";
import { ETIQUETA_CAUSA } from "../../utils/permisos";
import { useNotification } from "../../contexts/NotificationContext";

const ExpedienteIntegral = ({
  users,
  encuestas,
  notas,
  vacaciones,
  permisos,
  descuentos,
  reconocimientos,
  reportesConfidenciales,
  currentUser,
  archivosExpediente = [],
  onSubirArchivoExpediente,
  onEliminarArchivoExpediente
}) => {
  const { encuestaPreguntas, setUsuarios } = useGlobal();
  const { toast } = useNotification();
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // A propósito INCLUYE inactivos: el expediente es archivo/historial y debe
  // seguir consultable tras la baja (los dashboards sí los excluyen).
  const empleados = users.filter(u => ["empleado", "doctor"].includes(u.role));

  const [filtroSucursalExp, setFiltroSucursalExp] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || "");
  const [pestana, setPestana] = useState("general");
  const [mostrarSubirArchivo, setMostrarSubirArchivo] = useState(false);
  const [archivoExpediente, setArchivoExpediente] = useState(null);
  const [tipoArchivoExpediente, setTipoArchivoExpediente] = useState("General");
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [encuestaDetalle, setEncuestaDetalle] = useState(null);

  const empleadosFiltrados = filtrarEmpleadosExpediente(empleados, {
    sucursal: filtroSucursalExp,
    busqueda,
  });

  // Derivado, no estado: si el empleado elegido se sale del filtro, cae al primero de la lista
  // sin tener que reajustar `empleadoId` a mano en cada onChange.
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
        <EmptyState message="No hay empleados registrados." />
      </div>
    );
  }

  const encuestasEmpleado = getEncuestasEmpleado(encuestas, empleado.id);
  // Historial de solicitudes, lo más reciente primero por fecha de PETICIÓN (no por la
  // fecha que se pidió librar): así el expediente se lee en el orden en que ocurrió.
  const porSolicitudDesc = (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  const vacacionesEmpleado = vacaciones.filter(v => v.empleadoId === empleado.id).sort(porSolicitudDesc);
  const permisosEmpleado = permisos.filter(p => p.empleadoId === empleado.id).sort(porSolicitudDesc);
  const descuentosEmpleado = descuentos.filter(d => d.empleadoId === empleado.id);
  const reconocimientosEmpleado = reconocimientos.filter(r => r.empleadoId === empleado.id);
  const reportesEmpleado = reportesConfidenciales.filter(r => r.empleadoId === empleado.id);
  const archivosEmpleado = archivosExpediente.filter(a => a.empleadoId === empleado.id);

  const ps = calcPulseScore(empleado.id, encuestas);
  const ultimoScore = ps.score;
  const pulseStatus = getPulseStatus(ultimoScore);
  const estatus = estatusEmpleado(empleado);

  const esAdmin = currentUser?.role === "admin";
  const esRH = currentUser?.role === "rh" || currentUser?.role === "recursos humanos";
  const esPsicologa = currentUser?.role === "psicologa";
  const puedeVerEncuestas = esAdmin || esPsicologa;
  const puedeVerDescuentos = esAdmin || esRH;
  const puedeCambiarFoto = esAdmin || esPsicologa;

  // Notas psicológicas: Solo la psicóloga que la escribió puede verla (o por nombre para notas previas)
  const notasEmpleado = notas.filter(n =>
    n.empleadoId === empleado.id &&
    esPsicologa &&
    (n.autorId === currentUser.id || n.autor === currentUser.name)
  );

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

  // El número junto al nombre evita entrar a una pestaña para descubrir que está vacía: con
  // ocho pestañas, abrirlas a ciegas sería peor que la pared de tarjetas de antes.
  const conteo = (n) => (n > 0 ? ` (${n})` : "");
  const pestanas = [
    { value: "general", label: "General" },
    { value: "bienestar", label: "Bienestar" },
    { value: "archivos", label: `Archivos${conteo(archivosEmpleado.length)}` },
    { value: "ausencias", label: `Ausencias${conteo(vacacionesEmpleado.length + permisosEmpleado.length)}` },
    ...(puedeVerDescuentos ? [{ value: "descuentos", label: `Descuentos${conteo(descuentosEmpleado.length)}` }] : []),
    { value: "reconocimientos", label: `Reconocimientos${conteo(reconocimientosEmpleado.length)}` },
    ...(puedeVerEncuestas ? [{ value: "encuestas", label: `Encuestas${conteo(encuestasEmpleado.length)}` }] : []),
    { value: "confidenciales", label: `Confidenciales${conteo(reportesEmpleado.length)}` },
  ];
  // Si el rol no alcanza la pestaña guardada, cae a la primera en vez de dejar el panel en blanco.
  const pestanaActiva = pestanas.some(p => p.value === pestana) ? pestana : pestanas[0].value;

  const abrirArchivo = async (rutaArchivo) => {
    try {
      const url = await getSignedUrlArchivoExpediente(rutaArchivo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify.toast.error("No se pudo abrir el archivo.");
    }
  };

  return (
    <div className="admin-page expediente-page">
      <PageHeader
        icon="folderSearch"
        title="Expediente Integral"
        subtitle="Vista consolidada del colaborador: bienestar, administración y reconocimientos."
      />

      <Card>
        <div className="expediente-filtros">
          <div className="mc-form-group expediente-filtro-buscar">
            <label className="mc-form-label" htmlFor="exp-buscar">Buscar empleado</label>
            <div className="expediente-buscador">
              <Icon name="search" size={16} className="expediente-buscador-icono" />
              <input
                id="exp-buscar"
                type="search"
                className="mc-form-input expediente-buscador-input"
                placeholder="Nombre, puesto o sucursal"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="exp-filtro-sucursal">Sucursal</label>
            <select
              id="exp-filtro-sucursal"
              className="mc-form-select"
              value={filtroSucursalExp}
              onChange={(e) => setFiltroSucursalExp(e.target.value)}
            >
              <option value="Todas">Todas las sucursales</option>
              {[...new Set(empleados.map((emp) => normalizeSucursal(emp.sucursal)))].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="exp-empleado">Empleado</label>
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
          {empleadosFiltrados.length === 0
            ? `Ningún empleado coincide con la búsqueda. Mostrando ${empleado.name}.`
            : `Mostrando ${empleadosFiltrados.length} de ${empleados.length} empleados`}
        </div>
      </Card>

      <Card className="expediente-ficha">
        <div className="expediente-ficha-foto">
          <Avatar name={empleado.name} size={92} color="var(--mc-verde)" photoUrl={empleado.avatarUrl} />
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
        </div>

        <div className="expediente-ficha-datos">
          <h2 className="expediente-ficha-nombre">{empleado.name}</h2>
          <p className="expediente-ficha-puesto">
            {empleado.puesto} · {normalizeSucursal(empleado.sucursal)}
          </p>
          <div className="expediente-ficha-chips">
            <Badge variant={estatus.variante}>{estatus.texto}</Badge>
            <Badge tipo={pulseStatus.nivel} />
            {reconocimientosEmpleado.length > 0 && (
              <span className="expediente-ficha-medallas">
                <Icon name="award" size={14} />
                {reconocimientosEmpleado.length}
              </span>
            )}
          </div>
        </div>

        <div className="expediente-ficha-score">
          <div className="expediente-ficha-score-num">{ultimoScore}</div>
          <div className="expediente-ficha-score-label">Pulse Score™</div>
        </div>
      </Card>

      <div className="expediente-tabs-wrap">
        <Tabs
          options={pestanas}
          value={pestanaActiva}
          onChange={setPestana}
          ariaLabel="Secciones del expediente"
        />
      </div>

      <Card className="expediente-panel">
        {pestanaActiva === "general" && (
          <>
            <SectionTitle icon="pin">Datos generales</SectionTitle>
            <dl className="expediente-datos">
              <div className="expediente-dato"><dt>Nombre</dt><dd>{empleado.name}</dd></div>
              <div className="expediente-dato"><dt>Puesto</dt><dd>{empleado.puesto}</dd></div>
              <div className="expediente-dato"><dt>Sucursal</dt><dd>{normalizeSucursal(empleado.sucursal)}</dd></div>
              <div className="expediente-dato"><dt>Fecha de ingreso</dt><dd>{formatFechaIngreso(resolveFechaIngreso(empleado))}</dd></div>
              <div className="expediente-dato"><dt>Antigüedad</dt><dd>{formatAntiguedadEmpleado(empleado)}</dd></div>
              <div className="expediente-dato"><dt>Fecha de cumpleaños</dt><dd>{formatFechaCumpleanos(resolveFechaCumpleanos(empleado))}</dd></div>
              <div className="expediente-dato"><dt>Teléfono</dt><dd>{empleado.telefono || "No registrado"}</dd></div>
              {/* Antes decía "Activo" a secas, incluso en el expediente de alguien dado de baja
                  — y el expediente incluye inactivos a propósito. */}
              <div className="expediente-dato"><dt>Estatus</dt><dd>{estatus.texto}</dd></div>
            </dl>
          </>
        )}

        {pestanaActiva === "bienestar" && (
          <>
            <SectionTitle icon="heart">Bienestar</SectionTitle>
            <dl className="expediente-datos">
              <div className="expediente-dato"><dt>Encuestas registradas</dt><dd>{encuestasEmpleado.length}</dd></div>
              <div className="expediente-dato"><dt>Score actual</dt><dd>{ultimoScore}</dd></div>
              <div className="expediente-dato">
                <dt>Semáforo</dt>
                <dd><Badge tipo={pulseStatus.nivel} /></dd>
              </div>
              {esPsicologa && (
                <div className="expediente-dato"><dt>Notas psicológicas (propias)</dt><dd>{notasEmpleado.length}</dd></div>
              )}
            </dl>
          </>
        )}

        {pestanaActiva === "archivos" && (
          <>
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
            <div className="expediente-lista">
              {archivosEmpleado.length === 0 ? (
                <p className="mc-empty">No hay archivos adjuntos.</p>
              ) : (
                archivosEmpleado.map(a => (
                  <div key={a.id} className="expediente-fila expediente-fila--archivo">
                    <div className="expediente-fila-main">
                      <b>{a.tipoArchivo}</b>
                      <div className="admin-list-item-meta">{a.nombreArchivo}</div>
                    </div>
                    <div className="expediente-fila-acciones">
                      <button
                        type="button"
                        className="expediente-archivo-abrir"
                        onClick={() => abrirArchivo(a.rutaArchivo)}
                      >
                        Descargar
                      </button>
                      {onEliminarArchivoExpediente && (
                        <button
                          type="button"
                          className="expediente-archivo-borrar"
                          title="Eliminar archivo"
                          aria-label={`Eliminar ${a.nombreArchivo}`}
                          onClick={async () => {
                            const ok = await notify.confirm({
                              title: "Eliminar archivo",
                              description: `¿Eliminar "${a.nombreArchivo}" del expediente? Esta acción no se puede deshacer.`,
                              variant: "danger",
                              confirmText: "Eliminar",
                            });
                            if (ok) onEliminarArchivoExpediente({ id: a.id, rutaArchivo: a.rutaArchivo });
                          }}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {pestanaActiva === "ausencias" && (
          <>
            <SectionTitle icon="vacation">Vacaciones</SectionTitle>
            <div className="expediente-lista">
              {vacacionesEmpleado.length === 0 ? (
                <p className="mc-empty">Sin vacaciones registradas.</p>
              ) : vacacionesEmpleado.map(v => (
                <div key={v.id} className="expediente-fila">
                  {/* Aquí decía {v.inicio} al {v.fin}, y esos campos NO existen: el servicio
                      mapea fechaInicio/fechaFin. La fila salía como " al " — el expediente
                      llevaba tiempo mostrando vacaciones sin fecha. */}
                  <b>{v.fechaInicio || v.inicio || v.desde} al {v.fechaFin || v.fin || v.hasta}</b>
                  <div className="admin-list-item-meta">
                    {v.dias} días · {v.estado}
                    {v.motivo ? ` · ${v.motivo}` : ""}
                  </div>
                  {v.createdAt && (
                    <div className="detail-solicitud-fecha">
                      Solicitado el {formatFechaSolicitud(v.createdAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Permisos: el expediente tenía Vacaciones pero no Permisos, así que la mitad del
                historial de ausencias de una persona no estaba aquí. Mismo trato que en la ficha
                de Empleados, para que las dos pantallas cuenten lo mismo. */}
            <SectionTitle icon="clipboardCheck">Permisos</SectionTitle>
            <div className="expediente-lista">
              {permisosEmpleado.length === 0 ? (
                <p className="mc-empty">Sin permisos registrados.</p>
              ) : permisosEmpleado.map(p => (
                <div key={p.id} className="expediente-fila">
                  <b>
                    {p.fecha}
                    {p.fechaFin && p.fechaFin !== p.fecha ? ` al ${p.fechaFin}` : ""}
                    {p.hora ? ` · ${p.hora}` : ""}
                  </b>
                  <div className="admin-list-item-meta">
                    {p.estado}
                    {/* ETIQUETA_CAUSA: en la base la causa va acotada al catálogo
                        ('tramite_oficial') y sin traducir era eso lo que se leería. */}
                    {p.causa ? ` · ${ETIQUETA_CAUSA[p.causa] || p.causa}` : ""}
                    {p.motivo ? ` · ${p.motivo}` : ""}
                  </div>
                  {p.createdAt && (
                    <div className="detail-solicitud-fecha">
                      Solicitado el {formatFechaSolicitud(p.createdAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {pestanaActiva === "descuentos" && puedeVerDescuentos && (
          <>
            <SectionTitle icon="dollar">Descuentos</SectionTitle>
            <div className="expediente-lista">
              {descuentosEmpleado.length === 0 ? (
                <p className="mc-empty">Sin descuentos registrados.</p>
              ) : descuentosEmpleado.map(d => (
                <div key={d.id} className="expediente-fila">
                  <b>{d.tipo}</b>
                  <div className="admin-list-item-meta">${d.monto} · {d.estado}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {pestanaActiva === "reconocimientos" && (
          <>
            <SectionTitle icon="award">Reconocimientos</SectionTitle>
            <div className="expediente-lista">
              {reconocimientosEmpleado.length === 0 ? (
                <p className="mc-empty">Sin reconocimientos registrados.</p>
              ) : reconocimientosEmpleado.map(r => {
                const medalla = getMedalla(r.categoria);
                return (
                  <div key={r.id} className="expediente-fila expediente-fila--medalla">
                    <Medalla categoria={r.categoria} size={40} />
                    <div className="expediente-fila-main">
                      <b style={{ color: medalla.color }}>{r.categoria}</b>
                      <div className="admin-list-item-meta">{r.fecha} · {r.otorgadoPor}</div>
                      <div className="admin-list-item-body">{r.comentario}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {pestanaActiva === "encuestas" && puedeVerEncuestas && (
          <>
            <SectionTitle icon="clipboard">Encuestas</SectionTitle>
            <div className="expediente-lista">
              {encuestasEmpleado.length === 0 ? (
                <p className="mc-empty">Sin encuestas registradas.</p>
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
          </>
        )}

        {pestanaActiva === "confidenciales" && (
          <>
            <SectionTitle icon="lock">Reportes confidenciales</SectionTitle>
            <div className="expediente-lista">
              {reportesEmpleado.length === 0 ? (
                <p className="mc-empty">Sin reportes confidenciales registrados.</p>
              ) : reportesEmpleado.map(r => (
                <div key={r.id} className="expediente-fila">
                  <b>{r.tipo}</b>
                  <div className="admin-list-item-meta">{r.fecha} · Urgencia {r.urgencia} · {r.estado}</div>
                  <div className="admin-list-item-body">{r.descripcion}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

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
