import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import PilaAvatares from "./PilaAvatares";
import { notify } from "../../utils/notify";
import {
  getPublicaciones, publicar, subscribePublicaciones,
  getTareas, crearTarea, marcarTareaCompletada,
  getMiembros, getUsuariosParaAgregar, agregarMiembro, quitarMiembro,
  eliminarDepartamento,
} from "../../services/supabase/departamentosService";

const formatoHora = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const hora = d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === hoy.toDateString()) return hora;
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora}`;
  return `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}, ${hora}`;
};

const formatoFechaCorta = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};

// Qué tan cerca está la fecha límite, para pintar la pastilla: una tarea abierta con la
// fecha ya pasada tiene que saltar a la vista, no leerse igual que una de dentro de un mes.
const estadoFecha = (iso, terminada) => {
  if (!iso) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(`${iso}T00:00:00`) - hoy) / 86400000);
  if (terminada) return { clase: "neutra", texto: formatoFechaCorta(iso) };
  if (dias < 0) return { clase: "vencida", texto: `Venció ${formatoFechaCorta(iso)}` };
  if (dias === 0) return { clase: "pronto", texto: "Vence hoy" };
  if (dias === 1) return { clase: "pronto", texto: "Vence mañana" };
  return { clase: "neutra", texto: `Vence ${formatoFechaCorta(iso)}` };
};

// Mensajes seguidos de la misma persona se agrupan bajo una sola cara, como en cualquier
// chat: repetir nombre y avatar en cada línea hace el feed el doble de largo.
const VENTANA_AGRUPAR_MS = 10 * 60 * 1000;

/**
 * El "canal" de un departamento: publicaciones (avisos + mensajes) y tareas. El jefe además
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
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    getPublicaciones(departamento.id).then(setPublicaciones).finally(() => setCargandoFeed(false));
    getTareas(departamento.id).then(setTareas).finally(() => setCargandoTareas(false));
    getMiembros(departamento.id).then(setMiembros);
    const unsub = subscribePublicaciones(departamento.id, (nueva) => {
      setPublicaciones((prev) => (prev.some((p) => p.id === nueva.id) ? prev : [nueva, ...prev]));
    });
    return unsub;
  }, [departamento.id]);

  // Lo que llega por tiempo real es la fila cruda, sin el join a usuarios: el nombre y la
  // foto del autor se completan con la lista de miembros, que ya está cargada.
  const miembroPorId = new Map(miembros.map((m) => [m.usuarioId, m]));
  const autorDe = (p) => {
    const m = miembroPorId.get(p.autorId);
    return { nombre: p.autor || m?.nombre || "Alguien", avatarUrl: p.autorAvatarUrl || m?.avatarUrl };
  };

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

  const todosAsignados = miembros.length > 0 && miembros.every((m) => tAsignados.has(m.usuarioId));
  const toggleTodos = () => setTAsignados(todosAsignados ? new Set() : new Set(miembros.map((m) => m.usuarioId)));

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
    setBusqueda("");
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
      // Solo se mapea el candidato nuevo: los que ya estaban tienen forma de miembro
      // ({ usuarioId }), no de candidato ({ id }), y remapearlos los dejaba sin usuarioId —
      // sin etiqueta de jefe, con "Quitar" en todos y tareas asignadas a null.
      const nuevo = candidatos.find((c) => c.id === usuarioId);
      if (nuevo) setMiembros((prev) => [...prev, { usuarioId: nuevo.id, nombre: nuevo.nombre, puesto: nuevo.puesto, avatarUrl: nuevo.avatarUrl }]);
      setCandidatos((prev) => prev.filter((c) => c.id !== usuarioId));
      setBusqueda("");
    } catch (err) {
      notify.toast.error(err?.message || "No se pudo agregar.");
    }
  };

  // Sin acentos ni mayúsculas: "maria" encuentra a "MARÍA".
  const normalizar = (t) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const candidatosFiltrados = busqueda.trim()
    ? candidatos.filter((c) => normalizar(`${c.nombre} ${c.puesto}`).includes(normalizar(busqueda.trim())))
    : candidatos;

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

  // Para el jefe una tarea está terminada cuando TODOS sus asignados la marcaron; mientras
  // falte alguien sigue en "Por hacer", con su avance a la vista. Para un miembro asignado
  // cuenta SU parte: si ya la hizo, deja de estar pendiente para él aunque falten otros.
  const terminada = (t) => {
    const mia = !esJefe && t.asignados.find((a) => a.usuarioId === user?.id);
    if (mia) return mia.completada;
    return t.asignados.length > 0 && t.asignados.every((a) => a.completada);
  };
  const porHacer = tareas.filter((t) => !terminada(t));
  const hechas = tareas.filter(terminada);

  const renderTarea = (t) => {
    const hechosN = t.asignados.filter((a) => a.completada).length;
    const total = t.asignados.length;
    const lista = terminada(t);
    const fecha = estadoFecha(t.fechaLimite, lista);
    const mia = t.asignados.find((a) => a.usuarioId === user?.id);
    return (
      <article key={t.id} className={`departamento-tarea${lista ? " departamento-tarea--hecha" : ""}${mia && !mia.completada ? " departamento-tarea--mia" : ""}`}>
        <div className="departamento-tarea-top">
          <span className={`departamento-tarea-estado${lista ? " departamento-tarea-estado--hecha" : ""}`} aria-hidden="true">
            <Icon name={lista ? "checkSimple" : "clipboard"} size={16} />
          </span>
          <div className="departamento-tarea-info">
            <h3 className="departamento-tarea-titulo">{t.titulo}</h3>
            {t.descripcion && <p className="departamento-tarea-desc">{t.descripcion}</p>}
          </div>
          {fecha && (
            <span className={`departamento-fecha departamento-fecha--${fecha.clase}`}>
              <Icon name="calendar" size={12} /> {fecha.texto}
            </span>
          )}
        </div>

        {/* Solo el jefe: es quien da seguimiento al avance de todos. Al miembro la tarjeta
            le habla de lo suyo (el botón de abajo) y de con quién la comparte. */}
        {esJefe && total > 0 && (
          <div className="departamento-progreso">
            <div className="departamento-progreso-barra">
              <span style={{ width: `${(hechosN / total) * 100}%` }} />
            </div>
            <span className="departamento-progreso-texto">{hechosN} de {total} {total === 1 ? "lista" : "listos"}</span>
          </div>
        )}

        {esJefe ? (
          <div className="departamento-tarea-asignados">
            {t.asignados.map((a) => (
              <button
                key={a.usuarioId}
                type="button"
                className={`departamento-asignado${a.completada ? " departamento-asignado--hecha" : ""}`}
                onClick={() => toggleCompletada(t.id, a.usuarioId, a.completada)}
                title={a.completada ? `Marcar a ${a.nombre} como pendiente` : `Marcar a ${a.nombre} como completada`}
                aria-pressed={a.completada}
              >
                <Avatar name={a.nombre} photoUrl={a.avatarUrl} size={22} zoom={false} />
                <span className="departamento-asignado-nombre">{a.usuarioId === user?.id ? `${a.nombre} (tú)` : a.nombre}</span>
                <span className="departamento-asignado-check"><Icon name="checkSimple" size={12} /></span>
              </button>
            ))}
          </div>
        ) : (() => {
          // Vista del miembro: su botón y, al lado, a quiénes se asignó la tarea (solo texto),
          // él incluido — con su nombre, no con "Tú".
          const nombres = t.asignados.map((a) => a.nombre).filter(Boolean);
          return (
            <div className="departamento-tarea-pie">
              {mia && (
                <button
                  type="button"
                  className={`departamento-completar${mia.completada ? " departamento-completar--hecha" : ""}`}
                  onClick={() => toggleCompletada(t.id, mia.usuarioId, mia.completada)}
                  title={mia.completada ? "Volver a marcar como pendiente" : undefined}
                  aria-pressed={mia.completada}
                >
                  <span className="departamento-completar-check"><Icon name="checkSimple" size={13} /></span>
                  {mia.completada ? "Completada" : "Marcar como completada"}
                </button>
              )}
              {nombres.length > 0 && (
                <span className="departamento-tarea-con">
                  <Icon name="users" size={13} />
                  <span>Asignada a: {nombres.join(", ")}</span>
                </span>
              )}
            </div>
          );
        })()}
      </article>
    );
  };

  const modal = (contenido, onCerrar) => createPortal(
    <div className="mc-modal-overlay" onClick={onCerrar} role="presentation">
      <div className="mc-modal departamento-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {contenido}
      </div>
    </div>,
    document.body
  );

  const cabeceraModal = (titulo, sub, onCerrar) => (
    <div className="departamento-modal-head">
      <div>
        <h2 className="mc-modal-title">{titulo}</h2>
        {sub && <p className="departamento-modal-sub">{sub}</p>}
      </div>
      <button type="button" className="departamento-icon-btn" onClick={onCerrar} aria-label="Cerrar">
        <Icon name="close" size={18} />
      </button>
    </div>
  );

  return (
    <div className={`departamentos-page departamento-color--${departamento.color}`}>
      <header className="departamento-cabecera">
        <button type="button" className="departamento-icon-btn departamento-volver" onClick={onVolver} aria-label="Volver a departamentos">
          <Icon name="arrowLeft" size={18} />
        </button>
        <span className="departamento-cabecera-icono"><Icon name="users" size={24} /></span>
        <div className="departamento-cabecera-info">
          <h1>{departamento.nombre}</h1>
          {departamento.descripcion && <p>{departamento.descripcion}</p>}
        </div>
        <div className="departamento-cabecera-acciones">
          <button type="button" className="departamento-miembros-btn" onClick={abrirModalMiembros}>
            {miembros.length > 0 && <PilaAvatares personas={miembros} max={3} size={26} />}
            <span>{esJefe ? "Miembros" : "Ver miembros"} · {miembros.length}</span>
          </button>
          {esJefe && (
            <button type="button" className="departamento-icon-btn departamento-icon-btn--peligro" title="Eliminar departamento" aria-label="Eliminar departamento" onClick={eliminarDepartamentoAccion}>
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="departamento-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === "feed"} className={`departamento-tab${pestana === "feed" ? " departamento-tab--activo" : ""}`} onClick={() => setPestana("feed")}>
          <Icon name="message" size={15} /> Publicaciones
        </button>
        <button type="button" role="tab" aria-selected={pestana === "tareas"} className={`departamento-tab${pestana === "tareas" ? " departamento-tab--activo" : ""}`} onClick={() => setPestana("tareas")}>
          <Icon name="clipboardCheck" size={15} /> Tareas
          {porHacer.length > 0 && <span className="departamento-tab-contador">{porHacer.length}</span>}
        </button>
      </div>

      {pestana === "feed" ? (
        <Card className="departamento-feed-card">
          <div className="departamento-feed-lista" ref={feedRef}>
            {cargandoFeed ? (
              <EmptyState icon="message" title="Cargando…" message="Un momento." />
            ) : publicaciones.length === 0 ? (
              <EmptyState icon="message" title="Sin publicaciones todavía" message="Sé el primero en escribir algo aquí." />
            ) : (
              publicaciones.map((p, i) => {
                const autor = autorDe(p);
                // El arreglo va del más nuevo al más viejo: el anterior en el tiempo es i + 1.
                const previa = publicaciones[i + 1];
                const agrupada = p.tipo === "mensaje" && previa && previa.tipo === "mensaje" && previa.autorId === p.autorId
                  && new Date(p.createdAt) - new Date(previa.createdAt) < VENTANA_AGRUPAR_MS;
                if (p.tipo === "aviso") {
                  return (
                    <div key={p.id} className="departamento-aviso">
                      <div className="departamento-aviso-head">
                        <span className="departamento-aviso-icono"><Icon name="bell" size={15} /></span>
                        <span className="departamento-aviso-etiqueta">Aviso</span>
                        <span className="departamento-post-autor">{autor.nombre}</span>
                        <span className="departamento-post-fecha">{formatoHora(p.createdAt)}</span>
                      </div>
                      <p className="departamento-post-texto">{p.texto}</p>
                    </div>
                  );
                }
                return (
                  <div key={p.id} className={`departamento-post${agrupada ? " departamento-post--agrupada" : ""}`}>
                    <div className="departamento-post-avatar">
                      {!agrupada && <Avatar name={autor.nombre} photoUrl={autor.avatarUrl} size={34} />}
                    </div>
                    <div className="departamento-post-cuerpo">
                      {!agrupada && (
                        <div className="departamento-post-head">
                          <span className="departamento-post-autor">{autor.nombre}</span>
                          {p.autorId === departamento.jefeId && <span className="departamento-pill departamento-pill--jefe">Jefe</span>}
                          <span className="departamento-post-fecha">{formatoHora(p.createdAt)}</span>
                        </div>
                      )}
                      <p className="departamento-post-texto">{p.texto}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className={`departamento-composer${comoAviso && esJefe ? " departamento-composer--aviso" : ""}`}>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={onKeyDownComposer}
              placeholder={comoAviso && esJefe ? "Escribe el aviso para todo el departamento…" : "Escribe un mensaje…"}
              rows={2}
              aria-label="Mensaje"
            />
            <div className="departamento-composer-pie">
              {esJefe ? (
                <button
                  type="button"
                  className={`departamento-composer-toggle${comoAviso ? " departamento-composer-toggle--activo" : ""}`}
                  onClick={() => setComoAviso((v) => !v)}
                  aria-pressed={comoAviso}
                >
                  <Icon name="bell" size={14} /> {comoAviso ? "Se publicará como aviso" : "Publicar como aviso"}
                </button>
              ) : <span />}
              <span className="departamento-composer-ayuda">Enter para enviar · Shift + Enter, nueva línea</span>
              <button type="button" className="departamento-enviar" onClick={enviarPublicacion} disabled={enviando || !texto.trim()} aria-label="Enviar">
                <Icon name="send" size={17} />
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="departamento-tareas">
          <div className="departamento-tareas-head">
            <div className="departamento-tareas-resumen">
              <span><strong>{porHacer.length}</strong> por hacer</span>
              <span className="departamento-punto" aria-hidden="true" />
              <span><strong>{hechas.length}</strong> {hechas.length === 1 ? "terminada" : "terminadas"}</span>
            </div>
            {esJefe && (
              <button type="button" className="mc-btn-primary" onClick={abrirModalTarea}>
                <Icon name="plus" size={16} /> Nueva tarea
              </button>
            )}
          </div>
          {cargandoTareas ? (
            <Card><EmptyState icon="clipboard" title="Cargando…" message="Un momento." /></Card>
          ) : tareas.length === 0 ? (
            <Card>
              <EmptyState icon="clipboard" title="Sin tareas todavía" message={esJefe ? "Crea la primera con «Nueva tarea»." : "El jefe todavía no asigna tareas."} />
            </Card>
          ) : (
            <>
              {porHacer.length > 0 && (
                <section className="departamento-tareas-seccion">
                  <h2 className="departamento-seccion-titulo">Por hacer</h2>
                  <div className="departamento-tareas-lista">{porHacer.map(renderTarea)}</div>
                </section>
              )}
              {hechas.length > 0 && (
                <section className="departamento-tareas-seccion">
                  <h2 className="departamento-seccion-titulo">Terminadas</h2>
                  <div className="departamento-tareas-lista">{hechas.map(renderTarea)}</div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {modalTarea && modal(
        <>
          {cabeceraModal("Nueva tarea", `Para el equipo de ${departamento.nombre}`, () => !guardandoTarea && setModalTarea(false))}
          <form onSubmit={crearTareaAccion} className="mc-form-grid">
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="t-titulo">Título</label>
              <input id="t-titulo" type="text" className="mc-form-input" value={tTitulo} onChange={(e) => setTTitulo(e.target.value)} placeholder="Ej. Confirmar citas del sábado" autoFocus />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="t-desc">Descripción <span className="departamento-opcional">(opcional)</span></label>
              <textarea id="t-desc" className="mc-form-input" rows={3} value={tDescripcion} onChange={(e) => setTDescripcion(e.target.value)} placeholder="Detalles, pasos o dónde encontrar lo necesario" />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="t-fecha">Fecha límite <span className="departamento-opcional">(opcional)</span></label>
              <input id="t-fecha" type="date" className="mc-form-input" value={tFechaLimite} onChange={(e) => setTFechaLimite(e.target.value)} />
            </div>
            <div className="mc-form-group">
              <div className="departamento-asignar-head">
                <span className="mc-form-label">Asignar a</span>
                <button type="button" className="departamento-link" onClick={toggleTodos}>
                  {todosAsignados ? "Quitar a todos" : "Seleccionar a todos"}
                </button>
              </div>
              <div className="departamento-asignar-lista">
                {miembros.map((m) => {
                  const sel = tAsignados.has(m.usuarioId);
                  return (
                    <button
                      key={m.usuarioId}
                      type="button"
                      className={`departamento-asignar-chip${sel ? " departamento-asignar-chip--sel" : ""}`}
                      onClick={() => toggleAsignado(m.usuarioId)}
                      aria-pressed={sel}
                    >
                      <Avatar name={m.nombre} photoUrl={m.avatarUrl} size={24} zoom={false} />
                      <span>{m.usuarioId === user?.id ? `${m.nombre} (tú)` : m.nombre}</span>
                      {sel && <Icon name="checkSimple" size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mc-form-actions">
              <button type="button" className="mc-btn-secondary" onClick={() => setModalTarea(false)} disabled={guardandoTarea}>Cancelar</button>
              <button type="submit" className="mc-btn-primary" disabled={guardandoTarea}>
                {guardandoTarea ? "Asignando…" : tAsignados.size > 0 ? `Asignar a ${tAsignados.size}` : "Asignar tarea"}
              </button>
            </div>
          </form>
        </>,
        () => !guardandoTarea && setModalTarea(false)
      )}

      {modalMiembros && modal(
        <>
          {cabeceraModal("Miembros", `${departamento.nombre} · ${miembros.length} ${miembros.length === 1 ? "persona" : "personas"}`, () => setModalMiembros(false))}
          {cargandoMiembros ? (
            <p className="mc-form-hint">Cargando…</p>
          ) : (
            <>
              <div className="departamento-miembros-lista">
                {miembros.map((m) => (
                  <div key={m.usuarioId} className="departamento-persona">
                    <Avatar name={m.nombre} photoUrl={m.avatarUrl} size={36} />
                    <div className="departamento-persona-info">
                      <span className="departamento-persona-nombre">
                        {m.nombre}
                        {m.usuarioId === departamento.jefeId && <span className="departamento-pill departamento-pill--jefe">Jefe</span>}
                      </span>
                      {m.puesto && <span className="departamento-persona-puesto">{m.puesto}</span>}
                    </div>
                    {esJefe && m.usuarioId !== departamento.jefeId && (
                      <button type="button" className="departamento-icon-btn departamento-icon-btn--peligro" title="Quitar" aria-label={`Quitar a ${m.nombre}`} onClick={() => quitar(m.usuarioId)}>
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {esJefe && candidatos.length > 0 && (
                <div className="departamento-agregar">
                  <span className="mc-form-label">Agregar personas</span>
                  <div className="departamento-buscador">
                    <Icon name="search" size={16} />
                    <input
                      type="search"
                      className="mc-form-input"
                      placeholder="Buscar por nombre o puesto…"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  </div>
                  <div className="departamento-miembros-lista departamento-miembros-lista--candidatos">
                    {candidatosFiltrados.length === 0 && <p className="mc-form-hint">Nadie coincide con esa búsqueda.</p>}
                    {candidatosFiltrados.map((c) => (
                      <div key={c.id} className="departamento-persona">
                        <Avatar name={c.nombre} photoUrl={c.avatarUrl} size={36} />
                        <div className="departamento-persona-info">
                          <span className="departamento-persona-nombre">{c.nombre}</span>
                          {c.puesto && <span className="departamento-persona-puesto">{c.puesto}</span>}
                        </div>
                        <button type="button" className="departamento-agregar-btn" onClick={() => agregar(c.id)}>
                          <Icon name="plus" size={14} /> Agregar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>,
        () => setModalMiembros(false)
      )}
    </div>
  );
}
