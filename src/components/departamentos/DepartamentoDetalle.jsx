import { useState, useEffect, useRef } from "react";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import Icon from "../ui/Icon";
import { notify } from "../../utils/notify";
import {
  getPublicaciones, publicar, subscribePublicaciones,
  getTareas, crearTarea, marcarTareaCompletada,
  getMiembros, getUsuariosParaAgregar, agregarMiembro, quitarMiembro,
  eliminarDepartamento,
} from "../../services/supabase/departamentosService";

const formatoFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const formatoFechaCorta = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * El "canal" de un departamento: feed (avisos + mensajes) y tareas. El jefe además
 * administra miembros y puede eliminar el departamento.
 */
export default function DepartamentoDetalle({ user, departamento, onVolver, onEliminado }) {
  const esJefe = departamento.jefeId === user?.id;
  const [pestana, setPestana] = useState("feed");

  const [publicaciones, setPublicaciones] = useState([]);
  const [cargandoFeed, setCargandoFeed] = useState(true);
  const [texto, setTexto] = useState("");
  const [comoAviso, setComoAviso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const feedRef = useRef(null);

  const [tareas, setTareas] = useState([]);
  const [cargandoTareas, setCargandoTareas] = useState(true);
  const [modalTarea, setModalTarea] = useState(false);
  const [tTitulo, setTTitulo] = useState("");
  const [tDescripcion, setTDescripcion] = useState("");
  const [tFechaLimite, setTFechaLimite] = useState("");
  const [tAsignados, setTAsignados] = useState(() => new Set());
  const [guardandoTarea, setGuardandoTarea] = useState(false);

  const [miembros, setMiembros] = useState([]);
  const [modalMiembros, setModalMiembros] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [cargandoMiembros, setCargandoMiembros] = useState(false);

  useEffect(() => {
    getPublicaciones(departamento.id).then(setPublicaciones).finally(() => setCargandoFeed(false));
    getTareas(departamento.id).then(setTareas).finally(() => setCargandoTareas(false));
    getMiembros(departamento.id).then(setMiembros);
    const unsub = subscribePublicaciones(departamento.id, (nueva) => {
      setPublicaciones((prev) => (prev.some((p) => p.id === nueva.id) ? prev : [nueva, ...prev]));
    });
    return unsub;
  }, [departamento.id]);

  const enviarPublicacion = async () => {
    const contenido = texto.trim();
    if (!contenido) return;
    setEnviando(true);
    try {
      const nueva = await publicar(departamento.id, { tipo: comoAviso && esJefe ? "aviso" : "mensaje", texto: contenido });
      setPublicaciones((prev) => (prev.some((p) => p.id === nueva.id) ? prev : [nueva, ...prev]));
      setTexto("");
      setComoAviso(false);
    } catch (err) {
      notify.toast.error(err?.message || "No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  };

  const onKeyDownComposer = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarPublicacion(); }
  };

  const abrirModalTarea = () => {
    setTTitulo(""); setTDescripcion(""); setTFechaLimite(""); setTAsignados(new Set());
    setModalTarea(true);
  };

  const toggleAsignado = (usuarioId) => {
    setTAsignados((prev) => {
      const next = new Set(prev);
      if (next.has(usuarioId)) next.delete(usuarioId); else next.add(usuarioId);
      return next;
    });
  };

  const crearTareaAccion = async (e) => {
    e.preventDefault();
    if (!tTitulo.trim()) { notify.toast.warning("Ponle un título a la tarea."); return; }
    if (tAsignados.size === 0) { notify.toast.warning("Elige a quién se la asignas."); return; }
    setGuardandoTarea(true);
    try {
      await crearTarea({
        departamentoId: departamento.id,
        titulo: tTitulo.trim(),
        descripcion: tDescripcion.trim(),
        fechaLimite: tFechaLimite,
        asignados: [...tAsignados],
      });
      setTareas(await getTareas(departamento.id));
      setModalTarea(false);
      notify.toast.success("Tarea asignada.");
    } catch (err) {
      notify.toast.error(err?.message || "No se pudo crear la tarea.");
    } finally {
      setGuardandoTarea(false);
    }
  };

  const toggleCompletada = async (tareaId, usuarioId, actual) => {
    setTareas((prev) => prev.map((t) => t.id !== tareaId ? t : {
      ...t, asignados: t.asignados.map((a) => a.usuarioId === usuarioId ? { ...a, completada: !actual } : a),
    }));
    try {
      await marcarTareaCompletada(tareaId, usuarioId, !actual);
    } catch (err) {
      notify.toast.error(err?.message || "No se pudo actualizar la tarea.");
      setTareas(await getTareas(departamento.id)); // revertir al estado real
    }
  };

  const abrirModalMiembros = async () => {
    setModalMiembros(true);
    setCargandoMiembros(true);
    try {
      const [m, c] = await Promise.all([getMiembros(departamento.id), getUsuariosParaAgregar(departamento.id)]);
      setMiembros(m);
      setCandidatos(c);
    } finally {
      setCargandoMiembros(false);
    }
  };

  const agregar = async (usuarioId) => {
    try {
      await agregarMiembro(departamento.id, usuarioId);
      setMiembros((prev) => [...prev, candidatos.find((c) => c.id === usuarioId)].filter(Boolean).map((c) => ({ usuarioId: c.id, nombre: c.nombre, puesto: c.puesto })));
      setCandidatos((prev) => prev.filter((c) => c.id !== usuarioId));
    } catch (err) {
      notify.toast.error(err?.message || "No se pudo agregar.");
    }
  };

  const quitar = async (usuarioId) => {
    if (usuarioId === departamento.jefeId) { notify.toast.warning("El jefe no se puede quitar a sí mismo."); return; }
    const ok = await notify.confirm({ title: "Quitar del departamento", description: "¿Seguro que quieres quitar a esta persona?", variant: "danger", confirmText: "Quitar" });
    if (!ok) return;
    try {
      await quitarMiembro(departamento.id, usuarioId);
      setMiembros((prev) => prev.filter((m) => m.usuarioId !== usuarioId));
    } catch (err) {
      notify.toast.error(err?.message || "No se pudo quitar.");
    }
  };

  const eliminarDepartamentoAccion = async () => {
    const ok = await notify.confirm({
      title: "Eliminar departamento",
      description: `¿Seguro que quieres eliminar "${departamento.nombre}"? Se pierden sus avisos, mensajes y tareas. No se puede deshacer.`,
      variant: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    try {
      await eliminarDepartamento(departamento.id);
      notify.toast.success("Departamento eliminado.");
      onEliminado();
    } catch (err) {
      notify.toast.error(err?.message || "No se pudo eliminar.");
    }
  };

  return (
    <div className="departamentos-page">
      <div className={`departamento-cabecera departamento-cabecera--${departamento.color}`}>
        <button type="button" className="departamento-volver" onClick={onVolver} aria-label="Volver">
          <Icon name="arrowLeft" size={18} />
        </button>
        <div className="departamento-cabecera-info">
          <h1>{departamento.nombre}</h1>
          {departamento.descripcion && <p>{departamento.descripcion}</p>}
        </div>
        <div className="departamento-cabecera-acciones">
          <button type="button" className="mc-btn-secondary" onClick={abrirModalMiembros}>
            <Icon name="users" size={15} /> Miembros ({miembros.length})
          </button>
          {esJefe && (
            <button type="button" className="emp-table-icon-btn emp-table-icon-btn--danger" title="Eliminar departamento" onClick={eliminarDepartamentoAccion}>
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="departamento-tabs">
        <button type="button" className={`departamento-tab${pestana === "feed" ? " departamento-tab--activo" : ""}`} onClick={() => setPestana("feed")}>Feed</button>
        <button type="button" className={`departamento-tab${pestana === "tareas" ? " departamento-tab--activo" : ""}`} onClick={() => setPestana("tareas")}>Tareas</button>
      </div>

      {pestana === "feed" ? (
        <Card className="departamento-feed-card">
          <div className="departamento-feed-lista" ref={feedRef}>
            {cargandoFeed ? (
              <EmptyState icon="message" title="Cargando…" message="Un momento." />
            ) : publicaciones.length === 0 ? (
              <EmptyState icon="message" title="Sin publicaciones todavía" message="Sé el primero en escribir algo aquí." />
            ) : (
              publicaciones.map((p) => (
                <div key={p.id} className={`departamento-post${p.tipo === "aviso" ? " departamento-post--aviso" : ""}`}>
                  <div className="departamento-post-head">
                    <span className="departamento-post-autor">{p.autor}</span>
                    {p.tipo === "aviso" && <span className="departamento-post-badge">Aviso</span>}
                    <span className="departamento-post-fecha">{formatoFecha(p.createdAt)}</span>
                  </div>
                  <p className="departamento-post-texto">{p.texto}</p>
                </div>
              ))
            )}
          </div>
          <div className="departamento-composer">
            {esJefe && (
              <label className="departamento-composer-toggle">
                <input type="checkbox" checked={comoAviso} onChange={(e) => setComoAviso(e.target.checked)} />
                Publicar como aviso
              </label>
            )}
            <div className="departamento-composer-fila">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={onKeyDownComposer}
                placeholder={comoAviso && esJefe ? "Escribe el aviso para el departamento…" : "Escribe un mensaje…"}
                rows={2}
              />
              <button type="button" className="mc-btn-primary" onClick={enviarPublicacion} disabled={enviando || !texto.trim()}>
                <Icon name="send" size={16} />
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="departamento-tareas-card">
          {esJefe && (
            <div className="departamento-tareas-head">
              <button type="button" className="mc-btn-primary" onClick={abrirModalTarea}>
                <Icon name="plus" size={16} /> Nueva tarea
              </button>
            </div>
          )}
          {cargandoTareas ? (
            <EmptyState icon="clipboard" title="Cargando…" message="Un momento." />
          ) : tareas.length === 0 ? (
            <EmptyState icon="clipboard" title="Sin tareas todavía" message={esJefe ? "Crea la primera con el botón de arriba." : "El jefe todavía no asigna tareas."} />
          ) : (
            <div className="departamento-tareas-lista">
              {tareas.map((t) => (
                <div key={t.id} className="departamento-tarea">
                  <div className="departamento-tarea-info">
                    <span className="departamento-tarea-titulo">{t.titulo}</span>
                    {t.descripcion && <span className="departamento-tarea-desc">{t.descripcion}</span>}
                    {t.fechaLimite && <span className="departamento-tarea-fecha"><Icon name="calendar" size={12} /> {formatoFechaCorta(t.fechaLimite)}</span>}
                  </div>
                  <div className="departamento-tarea-asignados">
                    {t.asignados.map((a) => {
                      const puedeMarcar = esJefe || a.usuarioId === user?.id;
                      return (
                        <label key={a.usuarioId} className={`departamento-asignado${a.completada ? " departamento-asignado--hecha" : ""}`}>
                          <input
                            type="checkbox"
                            checked={a.completada}
                            disabled={!puedeMarcar}
                            onChange={() => toggleCompletada(t.id, a.usuarioId, a.completada)}
                          />
                          {a.nombre}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {modalTarea && (
        <div className="mc-modal-overlay" onClick={() => !guardandoTarea && setModalTarea(false)} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="mc-modal-title">Nueva tarea</h2>
            <form onSubmit={crearTareaAccion} className="mc-form-grid">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="t-titulo">Título</label>
                <input id="t-titulo" type="text" className="mc-form-input" value={tTitulo} onChange={(e) => setTTitulo(e.target.value)} autoFocus />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="t-desc">Descripción (opcional)</label>
                <textarea id="t-desc" className="mc-form-input" rows={2} value={tDescripcion} onChange={(e) => setTDescripcion(e.target.value)} />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="t-fecha">Fecha límite (opcional)</label>
                <input id="t-fecha" type="date" className="mc-form-input" value={tFechaLimite} onChange={(e) => setTFechaLimite(e.target.value)} />
              </div>
              <div className="mc-form-group">
                <span className="mc-form-label">Asignar a</span>
                <div className="departamento-asignar-lista">
                  {miembros.map((m) => (
                    <label key={m.usuarioId} className="departamento-asignar-item">
                      <input type="checkbox" checked={tAsignados.has(m.usuarioId)} onChange={() => toggleAsignado(m.usuarioId)} />
                      {m.nombre}
                    </label>
                  ))}
                </div>
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={() => setModalTarea(false)} disabled={guardandoTarea}>Cancelar</button>
                <button type="submit" className="mc-btn-primary" disabled={guardandoTarea}>{guardandoTarea ? "Creando…" : "Asignar tarea"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMiembros && (
        <div className="mc-modal-overlay" onClick={() => setModalMiembros(false)} role="presentation">
          <div className="mc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="mc-modal-title">Miembros de {departamento.nombre}</h2>
            {cargandoMiembros ? (
              <p className="mc-form-hint">Cargando…</p>
            ) : (
              <>
                <div className="departamento-miembros-lista">
                  {miembros.map((m) => (
                    <div key={m.usuarioId} className="departamento-miembro-fila">
                      <span>{m.nombre}{m.usuarioId === departamento.jefeId && <span className="departamento-card-jefe"> Jefe</span>}</span>
                      {esJefe && m.usuarioId !== departamento.jefeId && (
                        <button type="button" className="emp-table-icon-btn emp-table-icon-btn--danger" title="Quitar" onClick={() => quitar(m.usuarioId)}>
                          <Icon name="close" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {esJefe && candidatos.length > 0 && (
                  <>
                    <span className="mc-form-label">Agregar a alguien más</span>
                    <div className="departamento-miembros-lista">
                      {candidatos.map((c) => (
                        <div key={c.id} className="departamento-miembro-fila">
                          <span>{c.nombre} {c.puesto && <span className="mc-form-hint">— {c.puesto}</span>}</span>
                          <button type="button" className="mc-btn-secondary" onClick={() => agregar(c.id)}>Agregar</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            <div className="mc-form-actions">
              <button type="button" className="mc-btn-secondary" onClick={() => setModalMiembros(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
