import React, { useState, useEffect } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import Badge from "../common/Badge";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
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

/**
 * Una sección del expediente.
 *
 * Cuando está vacía se encoge a un renglón gris en vez de ocupar una tarjeta entera de aire:
 * con nueve secciones y una persona nueva, media pantalla eran cajas vacías y el expediente
 * parecía roto. Vacía sigue apareciendo —"no tiene archivos" es información— pero no grita.
 *
 * `accion` va SIEMPRE, esté vacía o no, y esa es la razón de que exista.
 * Al estar vacía no se pintan los `children`, así que cualquier botón metido ahí dentro
 * desaparecía justo cuando hacía falta. Es lo que le pasaba a "Subir archivo": solo se veía si
 * el expediente YA tenía un archivo, y para tener el primero había que poder subirlo. Nadie
 * pudo nunca — cero filas en `archivos_expediente` desde que existe la tabla. Lo que invita a
 * llenar una sección no puede depender de que la sección ya esté llena.
 */
const Seccion = ({ icono, titulo, vacio, children, cuenta, className = "", accion = null }) => {
  const estaVacia = !cuenta;
  return (
    <Card className={`expediente-seccion${estaVacia ? " expediente-seccion--vacia" : ""} ${className}`.trim()}>
      <SectionTitle icon={icono}>
        {titulo}
        {cuenta > 0 && <span className="expediente-seccion-cuenta">{cuenta}</span>}
      </SectionTitle>
      {estaVacia ? <p className="mc-empty expediente-seccion-vacio">{vacio}</p> : children}
      {accion}
    </Card>
  );
};

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
  // Solo manda en móvil, donde lista y detalle no caben a la vez. En escritorio se ven los dos.
  const [verDetalleMovil, setVerDetalleMovil] = useState(false);
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

  const elegirEmpleado = (id) => {
    setEmpleadoId(id);
    setVerDetalleMovil(true);
    setMostrarSubirArchivo(false);
  };

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

  const abrirArchivo = async (rutaArchivo) => {
    try {
      const url = await getSignedUrlArchivoExpediente(rutaArchivo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify.toast.error("No se pudo abrir el archivo.");
    }
  };

  return (
    <div className={`admin-page expediente-page${verDetalleMovil ? " expediente-page--detalle" : ""}`}>
      <PageHeader
        icon="folderSearch"
        title="Expediente Integral"
        subtitle="Vista consolidada del colaborador: bienestar, administración y reconocimientos."
      />

      <div className="expediente-split">
        <Card className="expediente-listado">
          <div className="expediente-buscador">
            <Icon name="search" size={16} className="expediente-buscador-icono" />
            <input
              type="search"
              className="mc-form-input expediente-buscador-input"
              placeholder="Buscar por nombre o puesto"
              aria-label="Buscar empleado"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <select
            className="mc-form-select expediente-listado-sucursal"
            aria-label="Filtrar por sucursal"
            value={filtroSucursalExp}
            onChange={(e) => setFiltroSucursalExp(e.target.value)}
          >
            <option value="Todas">Todas las sucursales</option>
            {[...new Set(empleados.map((emp) => normalizeSucursal(emp.sucursal)))].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className="expediente-listado-cuenta">
            {empleadosFiltrados.length} de {empleados.length} empleados
          </div>

          <div className="expediente-listado-filas">
            {empleadosFiltrados.length === 0 ? (
              <p className="mc-empty">Nadie coincide con esa búsqueda.</p>
            ) : empleadosFiltrados.map((emp) => {
              const empPs = calcPulseScore(emp.id, encuestas);
              const empEstado = getPulseStatus(empPs.score);
              const activa = String(emp.id) === String(empleado.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  className={`expediente-fila-emp${activa ? " expediente-fila-emp--activa" : ""}`}
                  onClick={() => elegirEmpleado(emp.id)}
                  aria-current={activa ? "true" : undefined}
                >
                  {/* zoom={false}: el avatar va dentro de este botón, y un botón dentro de otro
                      es HTML inválido. La foto en grande se pica en la ficha de la derecha. */}
                  <Avatar name={emp.name} size={36} slug={empEstado.nivel} photoUrl={emp.avatarUrl} zoom={false} />
                  <span className="expediente-fila-emp-texto">
                    <span className="expediente-fila-emp-nombre">{emp.name}</span>
                    <span className="expediente-fila-emp-meta">{emp.puesto}</span>
                  </span>
                  <span className={`expediente-fila-emp-score expediente-fila-emp-score--${empEstado.nivel}`}>
                    {empPs.score}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="expediente-detalle">
          <button
            type="button"
            className="expediente-volver mc-btn-outline mc-btn-with-icon"
            onClick={() => setVerDetalleMovil(false)}
          >
            {/* No hay chevron a la izquierda en el catálogo; se gira el de abajo por CSS en
                vez de meter un icono nuevo solo para esto. */}
            <Icon name="chevronDown" size={16} className="expediente-volver-icono" /> Volver a la lista
          </button>

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

          <div className="expediente-secciones">
            {/* A lo ancho: son ocho datos cortos, y en una tarjeta estrecha se apilaban en ocho
                renglones ocupando media pantalla. Su propia rejilla interna
                (`expediente-datos`) los reparte en cuatro columnas en cuanto tiene sitio. */}
            <Seccion icono="pin" titulo="Datos generales" cuenta={1} className="expediente-seccion--ancha">
              <dl className="expediente-datos">
                <div className="expediente-dato"><dt>Puesto</dt><dd>{empleado.puesto}</dd></div>
                <div className="expediente-dato"><dt>Sucursal</dt><dd>{normalizeSucursal(empleado.sucursal)}</dd></div>
                <div className="expediente-dato"><dt>Fecha de ingreso</dt><dd>{formatFechaIngreso(resolveFechaIngreso(empleado))}</dd></div>
                <div className="expediente-dato"><dt>Antigüedad</dt><dd>{formatAntiguedadEmpleado(empleado)}</dd></div>
                <div className="expediente-dato"><dt>Cumpleaños</dt><dd>{formatFechaCumpleanos(resolveFechaCumpleanos(empleado))}</dd></div>
                <div className="expediente-dato"><dt>Teléfono</dt><dd>{empleado.telefono || "No registrado"}</dd></div>
                {/* Antes decía "Activo" a secas, incluso en el expediente de alguien dado de
                    baja — y el expediente incluye inactivos a propósito. */}
                <div className="expediente-dato"><dt>Estatus</dt><dd>{estatus.texto}</dd></div>
                <div className="expediente-dato"><dt>Encuestas</dt><dd>{encuestasEmpleado.length}</dd></div>
                {esPsicologa && (
                  <div className="expediente-dato"><dt>Notas propias</dt><dd>{notasEmpleado.length}</dd></div>
                )}
              </dl>
            </Seccion>

            <Seccion
              icono="paperclip"
              titulo="Archivos del expediente"
              cuenta={archivosEmpleado.length || (mostrarSubirArchivo ? 1 : 0)}
              vacio="No hay archivos adjuntos."
              className="expediente-seccion--ancha"
              accion={
                mostrarSubirArchivo ? (
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
                ) : (
                  <button
                    type="button"
                    className="mc-btn-outline mc-btn-with-icon expediente-subir-btn"
                    onClick={() => setMostrarSubirArchivo(true)}
                  >
                    <Icon name="plus" size={16} /> Subir archivo
                  </button>
                )
              }
            >
              <div className="expediente-lista">
                {archivosEmpleado.map(a => (
                  <div key={a.id} className="expediente-fila expediente-fila--archivo">
                    <div className="expediente-fila-main">
                      <b>{a.tipoArchivo}</b>
                      <div className="admin-list-item-meta">{a.nombreArchivo}</div>
                    </div>
                    <div className="expediente-fila-acciones">
                      <button type="button" className="expediente-archivo-abrir" onClick={() => abrirArchivo(a.rutaArchivo)}>
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
                ))}
              </div>
            </Seccion>

            <Seccion icono="vacation" titulo="Vacaciones" cuenta={vacacionesEmpleado.length} vacio="Sin vacaciones registradas." className="expediente-seccion--ancha">
              <div className="expediente-lista">
                {vacacionesEmpleado.map(v => (
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
                      <div className="detail-solicitud-fecha">Solicitado el {formatFechaSolicitud(v.createdAt)}</div>
                    )}
                  </div>
                ))}
              </div>
            </Seccion>

            {/* Permisos: el expediente tenía Vacaciones pero no Permisos, así que la mitad del
                historial de ausencias de una persona no estaba aquí. */}
            <Seccion icono="clipboardCheck" titulo="Permisos" cuenta={permisosEmpleado.length} vacio="Sin permisos registrados." className="expediente-seccion--ancha">
              <div className="expediente-lista">
                {permisosEmpleado.map(p => (
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
                      <div className="detail-solicitud-fecha">Solicitado el {formatFechaSolicitud(p.createdAt)}</div>
                    )}
                  </div>
                ))}
              </div>
            </Seccion>

            {puedeVerDescuentos && (
              <Seccion icono="dollar" titulo="Descuentos" cuenta={descuentosEmpleado.length} vacio="Sin descuentos registrados." className="expediente-seccion--ancha">
                <div className="expediente-lista">
                  {descuentosEmpleado.map(d => (
                    <div key={d.id} className="expediente-fila">
                      <b>{d.tipo}</b>
                      <div className="admin-list-item-meta">${d.monto} · {d.estado}</div>
                    </div>
                  ))}
                </div>
              </Seccion>
            )}

            <Seccion icono="award" titulo="Reconocimientos" cuenta={reconocimientosEmpleado.length} vacio="Sin reconocimientos registrados." className="expediente-seccion--ancha">
              <div className="expediente-lista">
                {reconocimientosEmpleado.map(r => {
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
            </Seccion>

            {puedeVerEncuestas && (
              <Seccion
                icono="clipboard"
                titulo="Encuestas"
                cuenta={encuestasEmpleado.length}
                vacio="Sin encuestas registradas."
                className="expediente-seccion--ancha"
              >
                <div className="expediente-lista">
                  {encuestasEmpleado.map((enc) => {
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
                            <span className="expediente-encuesta-semaforo"><Badge tipo={sem} /></span>
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
                  })}
                </div>
              </Seccion>
            )}

            <Seccion icono="lock" titulo="Reportes confidenciales" cuenta={reportesEmpleado.length} vacio="Sin reportes confidenciales." className="expediente-seccion--ancha">
              <div className="expediente-lista">
                {reportesEmpleado.map(r => (
                  <div key={r.id} className="expediente-fila">
                    <b>{r.tipo}</b>
                    <div className="admin-list-item-meta">{r.fecha} · Urgencia {r.urgencia} · {r.estado}</div>
                    <div className="admin-list-item-body">{r.descripcion}</div>
                  </div>
                ))}
              </div>
            </Seccion>
          </div>
        </div>
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
