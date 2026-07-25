import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { notify } from "../../utils/notify";

const COLORES = ["azul", "morado", "rosa", "ambar", "verde", "aqua", "rojo", "gris"];

// Modal para crear o editar un evento/cita de la agenda. `evento` = null para uno nuevo (con
// `fechaInicial` preseleccionada) o el evento a editar. Gestión es quien lo usa.
const EventoModal = ({ evento, fechaInicial, onGuardar, onEliminar, onCerrar }) => {
  const editando = !!evento;
  const [form, setForm] = useState(() => ({
    titulo: evento?.titulo || "",
    fecha: evento?.fecha || fechaInicial || new Date().toLocaleDateString("en-CA"),
    todoElDia: evento?.todoElDia ?? false,
    horaInicio: evento?.horaInicio || "09:00",
    horaFin: evento?.horaFin || "10:00",
    color: evento?.color || "azul",
    ubicacion: evento?.ubicacion || "",
    descripcion: evento?.descripcion || "",
  }));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const guardar = async () => {
    if (!form.titulo.trim()) { notify.toast.warning("Escribe un título."); return; }
    if (!form.todoElDia && form.horaFin <= form.horaInicio) {
      notify.toast.warning("La hora de fin debe ser después de la de inicio."); return;
    }
    setGuardando(true);
    const ok = await onGuardar(form);
    setGuardando(false);
    if (ok) onCerrar();
  };

  const eliminar = async () => {
    const ok = await notify.confirm({
      title: "Eliminar evento", description: `¿Eliminar "${evento.titulo}"?`,
      variant: "danger", confirmText: "Eliminar",
    });
    if (!ok) return;
    const done = await onEliminar(evento.id);
    if (done) onCerrar();
  };

  return (
    <div className="mc-modal-overlay" onClick={onCerrar} role="presentation">
      <div className="mc-modal evento-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="evento-modal-head">
          <h2 className="mc-modal-title">{editando ? "Editar evento" : "Nuevo evento"}</h2>
          <button type="button" className="evento-modal-x" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="xCircle" size={20} />
          </button>
        </div>

        <div className="mc-form-group">
          <label className="mc-form-label" htmlFor="ev-titulo">Título</label>
          <input id="ev-titulo" className="mc-form-input" value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej. Junta de equipo" autoFocus />
        </div>

        <div className="mc-form-row-2">
          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="ev-fecha">Fecha</label>
            <input id="ev-fecha" type="date" className="mc-form-input" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} />
          </div>
          <div className="mc-form-group evento-todo-dia">
            <label className="mc-form-label">&nbsp;</label>
            <label className="evento-check">
              <input type="checkbox" checked={form.todoElDia} onChange={(e) => set("todoElDia", e.target.checked)} />
              Todo el día
            </label>
          </div>
        </div>

        {!form.todoElDia && (
          <div className="mc-form-row-2">
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="ev-hi">Inicio</label>
              <input id="ev-hi" type="time" className="mc-form-input" value={form.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label" htmlFor="ev-hf">Fin</label>
              <input id="ev-hf" type="time" className="mc-form-input" value={form.horaFin} onChange={(e) => set("horaFin", e.target.value)} />
            </div>
          </div>
        )}

        <div className="mc-form-group">
          <label className="mc-form-label">Color</label>
          <div className="evento-colores">
            {COLORES.map((c) => (
              <button key={c} type="button" aria-label={c}
                className={`evento-color evento-color--${c}${form.color === c ? " evento-color--sel" : ""}`}
                onClick={() => set("color", c)} />
            ))}
          </div>
        </div>

        <div className="mc-form-group">
          <label className="mc-form-label" htmlFor="ev-ubic">Ubicación (opcional)</label>
          <input id="ev-ubic" className="mc-form-input" value={form.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} placeholder="Ej. Consultorio 2" />
        </div>

        <div className="mc-form-group">
          <label className="mc-form-label" htmlFor="ev-desc">Descripción (opcional)</label>
          <textarea id="ev-desc" className="mc-form-textarea" rows={2} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
        </div>

        <div className="evento-modal-actions">
          {editando && (
            <button type="button" className="mc-btn-danger" onClick={eliminar}>
              <Icon name="xCircle" size={15} /> Eliminar
            </button>
          )}
          <div className="evento-modal-actions-main">
            <button type="button" className="mc-btn-outline" onClick={onCerrar}>Cancelar</button>
            <button type="button" className="mc-btn-primary" onClick={guardar} disabled={guardando}>
              <Icon name="check" size={15} /> {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventoModal;
