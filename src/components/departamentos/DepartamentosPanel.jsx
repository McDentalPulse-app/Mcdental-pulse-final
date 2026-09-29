import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
import Icon from "../ui/Icon";
import { notify } from "../../utils/notify";
import { getMisDepartamentos, crearDepartamento, getResumenDepartamentos } from "../../services/supabase/departamentosService";
import DepartamentoDetalle from "./DepartamentoDetalle";
import PilaAvatares from "./PilaAvatares";

// Misma paleta que los eventos del calendario (EventoModal.jsx) — mismo lenguaje visual,
// sin inventar tokens de color nuevos.
const COLORES_DEPARTAMENTO = ["azul", "morado", "rosa", "ambar", "verde", "aqua", "rojo", "gris"];

/**
 * Departamentos internos, estilo "clases"/Teams de Microsoft Teams: tarjetas de los
 * departamentos a los que perteneces, clic para entrar al canal (avisos + mensajes +
 * tareas). Crear uno nuevo requiere el permiso puede_crear_departamento (mig. 133),
 * activable por gestión en Gestión de Personal.
 */
export default function DepartamentosPanel({ user }) {
  const [departamentos, setDepartamentos] = useState([]);
  const [resumen, setResumen] = useState({});
  const [cargando, setCargando] = useState(true);
  const [abiertoId, setAbiertoId] = useState(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState(COLORES_DEPARTAMENTO[0]);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    getMisDepartamentos()
      .then(setDepartamentos)
      .catch(() => notify.toast.error("No se pudieron cargar los departamentos."))
      .finally(() => setCargando(false));
    // El resumen es adorno: si falla, las tarjetas salen igual, solo sin caras ni contadores.
    getResumenDepartamentos(user?.id).then(setResumen).catch(() => {});
  };

  useEffect(() => { cargar(); }, []);

  const abrirModalCrear = () => {
    setNombre(""); setDescripcion(""); setColor(COLORES_DEPARTAMENTO[0]);
    setModalCrear(true);
  };

  const crear = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { notify.toast.warning("Ponle un nombre al departamento."); return; }
    setGuardando(true);
    try {
      const nuevo = await crearDepartamento({ nombre: nombre.trim(), descripcion: descripcion.trim(), color });
      setDepartamentos((prev) => [...prev, nuevo]);
      setModalCrear(false);
      setAbiertoId(nuevo.id);
    } catch (err) {
      notify.toast.error(err?.message || "No se pudo crear el departamento.");
    } finally {
      setGuardando(false);
    }
  };

  const abierto = departamentos.find((d) => d.id === abiertoId);
  if (abierto) {
    return (
      <DepartamentoDetalle
        user={user}
        departamento={abierto}
        onVolver={() => { setAbiertoId(null); cargar(); }}
        onEliminado={() => { setAbiertoId(null); cargar(); }}
      />
    );
  }

  return (
    <div className="departamentos-page">
      <PageHeader icon="users" title="Departamentos" subtitle="Tu equipo, sus avisos, pendientes y tareas — como un canal propio.">
        {user?.puedeCrearDepartamento && (
          <button type="button" className="mc-btn-primary" onClick={abrirModalCrear}>
            <Icon name="plus" size={16} /> Crear departamento
          </button>
        )}
      </PageHeader>

      {cargando ? (
        <EmptyState icon="users" title="Cargando…" message="Un momento, cargando tus departamentos." />
      ) : departamentos.length === 0 ? (
        <EmptyState
          icon="users"
          title="Todavía no perteneces a ningún departamento"
          message={
            user?.puedeCrearDepartamento
              ? "Crea el tuyo con el botón de arriba."
              : "Cuando el jefe de un departamento te agregue, aparecerá aquí."
          }
        />
      ) : (
        <div className="departamentos-grid">
          {departamentos.map((d) => {
            const r = resumen[d.id];
            const miembros = r?.miembros || [];
            return (
              <button key={d.id} type="button" className={`departamento-card departamento-color--${d.color}`} onClick={() => setAbiertoId(d.id)}>
                <span className="departamento-card-banda">
                  <span className="departamento-card-icono"><Icon name="users" size={22} /></span>
                  {d.jefeId === user?.id && <span className="departamento-pill departamento-pill--jefe">Jefe</span>}
                </span>
                <span className="departamento-card-cuerpo">
                  <span className="departamento-card-nombre">{d.nombre}</span>
                  <span className={`departamento-card-desc${d.descripcion ? "" : " departamento-card-desc--vacia"}`}>
                    {d.descripcion || "Sin descripción"}
                  </span>
                </span>
                <span className="departamento-card-pie">
                  {miembros.length > 0 ? <PilaAvatares personas={miembros} max={4} size={26} /> : <span />}
                  <span className="departamento-card-meta">
                    {r && (
                      <span className="departamento-card-dato">
                        <Icon name="users" size={13} /> {miembros.length}
                      </span>
                    )}
                    {r?.misPendientes > 0 ? (
                      <span className="departamento-pill departamento-pill--pendiente">
                        {r.misPendientes} {r.misPendientes === 1 ? "pendiente" : "pendientes"}
                      </span>
                    ) : r?.tareasAbiertas > 0 ? (
                      <span className="departamento-card-dato">
                        <Icon name="clipboardCheck" size={13} /> {r.tareasAbiertas} {r.tareasAbiertas === 1 ? "abierta" : "abiertas"}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {modalCrear && createPortal(
        <div className="mc-modal-overlay" onClick={() => !guardando && setModalCrear(false)} role="presentation">
          <div className="mc-modal departamento-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="departamento-modal-head">
              <div>
                <h2 className="mc-modal-title">Nuevo departamento</h2>
                <p className="departamento-modal-sub">Tú quedas como jefe. Después agregas a tu equipo.</p>
              </div>
              <button type="button" className="departamento-icon-btn" onClick={() => !guardando && setModalCrear(false)} aria-label="Cerrar">
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={crear} className="mc-form-grid">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="dep-nombre">Nombre</label>
                <input
                  id="dep-nombre"
                  type="text"
                  className="mc-form-input"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Marketing, Recepción, TI…"
                  autoFocus
                />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="dep-desc">Descripción (opcional)</label>
                <input
                  id="dep-desc"
                  type="text"
                  className="mc-form-input"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>
              <div className="mc-form-group">
                <span className="mc-form-label">Color</span>
                <div className="evento-colores">
                  {COLORES_DEPARTAMENTO.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`evento-color evento-color--${c}${color === c ? " evento-color--sel" : ""}`}
                      onClick={() => setColor(c)}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <div className="mc-form-actions">
                <button type="button" className="mc-btn-secondary" onClick={() => setModalCrear(false)} disabled={guardando}>Cancelar</button>
                <button type="submit" className="mc-btn-primary" disabled={guardando}>{guardando ? "Creando…" : "Crear"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
