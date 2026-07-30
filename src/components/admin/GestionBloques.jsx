import { useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { getISOWeek } from "../../utils/constants";
import { bloqueDeLaSemana, quincenaNumero } from "../../utils/encuestaBloques";
import {
  crearBloque,
  actualizarBloque,
  eliminarBloque,
} from "../../services/supabase/encuestaPreguntasService";

// Banco de bloques rotatorios de la encuesta.
//
// Qué bloque toca cada quincena NO se guarda ni se programa: se deriva del número de quincena
// y del orden de esta lista (ver utils/encuestaBloques.js). Por eso aquí no hay fechas — solo
// se administra el banco y su orden, y la rotación sale sola. Añadir un bloque al final no
// descoloca lo que ya está en curso.
export default function GestionBloques() {
  const { encuestaBloques, setEncuestaBloques, encuestaPreguntas } = useGlobal();
  const { toast, confirm } = useNotification();

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nombreTemp, setNombreTemp] = useState("");
  const [ocupado, setOcupado] = useState(null); // id del bloque en curso

  const semana = getISOWeek();
  const activo = bloqueDeLaSemana(semana, encuestaBloques);
  const quincena = quincenaNumero(semana);

  const ordenados = [...encuestaBloques].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.id).localeCompare(String(b.id)),
  );

  const cuantasPreguntas = (bloqueId) =>
    encuestaPreguntas.filter((p) => p.bloqueId === bloqueId).length;

  const agregar = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      toast.warning("Escribe el nombre del bloque.");
      return;
    }
    setCreando(true);
    try {
      const orden = ordenados.length
        ? Math.max(...ordenados.map((b) => b.orden ?? 0)) + 1
        : 1;
      const nuevo = await crearBloque({ nombre, orden });
      setEncuestaBloques((prev) => [...prev, nuevo]);
      setNuevoNombre("");
      toast.success(`Bloque "${nuevo.nombre}" agregado al banco.`);
    } catch (e) {
      toast.error(e?.message || "No se pudo crear el bloque.");
    } finally {
      setCreando(false);
    }
  };

  const guardarNombre = async (bloque) => {
    const nombre = nombreTemp.trim();
    if (!nombre) {
      toast.warning("El nombre no puede quedar vacío.");
      return;
    }
    if (nombre === bloque.nombre) {
      setEditandoId(null);
      return;
    }
    setOcupado(bloque.id);
    try {
      const actualizado = await actualizarBloque(bloque.id, { nombre });
      setEncuestaBloques((prev) =>
        prev.map((b) => (b.id === bloque.id ? { ...b, ...actualizado } : b)),
      );
      setEditandoId(null);
      toast.success("Nombre actualizado.");
    } catch (e) {
      toast.error(e?.message || "No se pudo cambiar el nombre.");
    } finally {
      setOcupado(null);
    }
  };

  const alternarActivo = async (bloque) => {
    setOcupado(bloque.id);
    try {
      const actualizado = await actualizarBloque(bloque.id, { activo: !bloque.activo });
      setEncuestaBloques((prev) =>
        prev.map((b) => (b.id === bloque.id ? { ...b, ...actualizado } : b)),
      );
      toast.success(bloque.activo ? "Bloque desactivado." : "Bloque activado.");
    } catch (e) {
      toast.error(e?.message || "No se pudo cambiar el estado.");
    } finally {
      setOcupado(null);
    }
  };

  // Mover cambia el orden, y el orden es lo que decide la rotación: subir un bloque lo
  // adelanta en la secuencia de quincenas.
  const mover = async (bloque, direccion) => {
    const i = ordenados.findIndex((b) => b.id === bloque.id);
    const j = i + direccion;
    if (j < 0 || j >= ordenados.length) return;

    const otro = ordenados[j];
    setOcupado(bloque.id);
    try {
      const [a, b] = await Promise.all([
        actualizarBloque(bloque.id, { orden: otro.orden ?? j + 1 }),
        actualizarBloque(otro.id, { orden: bloque.orden ?? i + 1 }),
      ]);
      setEncuestaBloques((prev) =>
        prev.map((x) => {
          if (x.id === a.id) return { ...x, ...a };
          if (x.id === b.id) return { ...x, ...b };
          return x;
        }),
      );
    } catch (e) {
      toast.error(e?.message || "No se pudo reordenar.");
    } finally {
      setOcupado(null);
    }
  };

  const borrar = async (bloque) => {
    const preguntas = cuantasPreguntas(bloque.id);
    if (preguntas > 0) {
      toast.error(
        preguntas === 1
          ? "Este bloque tiene 1 pregunta. Muévela al núcleo o a otro bloque antes de borrarlo."
          : `Este bloque tiene ${preguntas} preguntas. Muévelas antes de borrarlo.`,
      );
      return;
    }

    const ok = await confirm({
      title: "Eliminar bloque",
      description: `¿Deseas eliminar el bloque "${bloque.nombre}"? Esta acción no se puede deshacer.`,
      variant: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;

    setOcupado(bloque.id);
    try {
      await eliminarBloque(bloque.id);
      setEncuestaBloques((prev) => prev.filter((b) => b.id !== bloque.id));
      toast.success(`Bloque "${bloque.nombre}" eliminado.`);
    } catch (e) {
      toast.error(e?.message || "No se pudo eliminar el bloque.");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Card>
      <SectionTitle icon="clipboard">Bloques que rotan cada quincena</SectionTitle>

      <p className="mc-hint">
        <Icon name="alert" size={15} />
        <span>
          Las preguntas del <strong>núcleo</strong> se hacen todas las semanas y son las que
          calculan el Pulse Score. Encima de ellas rota un <strong>bloque</strong>, que cambia
          cada dos semanas siguiendo el orden de esta lista y vuelve a empezar cuando se acaba.
          No hay que programar fechas. Si el banco está vacío, se pregunta solo el núcleo.
        </span>
      </p>

      <div className="mc-form-group">
        <label className="mc-form-label" htmlFor="nuevo-bloque">Agregar bloque</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            id="nuevo-bloque"
            className="mc-form-input"
            style={{ flex: 1, minWidth: 200 }}
            type="text"
            placeholder="Ej. Carga de trabajo"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") agregar(); }}
            disabled={creando}
          />
          <button
            type="button"
            className="mc-btn-primary mc-btn-with-icon"
            onClick={agregar}
            disabled={creando}
          >
            <Icon name="plus" size={16} /> {creando ? "Agregando…" : "Agregar"}
          </button>
        </div>
      </div>

      {!ordenados.length ? (
        <p className="mc-empty">
          Todavía no hay bloques. La encuesta es solo el núcleo, igual que siempre.
        </p>
      ) : (
        <div className="rh-data-list">
          {ordenados.map((b, i) => {
            const esElDeAhora = activo?.id === b.id;
            const enCurso = ocupado === b.id;

            return (
              <div key={b.id} className="rh-data-row">
                <div className="rh-data-row-main">
                  {editandoId === b.id ? (
                    <input
                      className="mc-form-input"
                      value={nombreTemp}
                      autoFocus
                      onChange={(e) => setNombreTemp(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") guardarNombre(b);
                        if (e.key === "Escape") setEditandoId(null);
                      }}
                      disabled={enCurso}
                    />
                  ) : (
                    <>
                      <div className="rh-data-row-title">{b.nombre}</div>
                      <div className="rh-data-row-sub">
                        {cuantasPreguntas(b.id) === 1
                          ? "1 pregunta"
                          : `${cuantasPreguntas(b.id)} preguntas`}
                        {" · "}
                        {b.activo ? `turno ${i + 1} de ${ordenados.filter((x) => x.activo).length}` : "fuera de la rotación"}
                      </div>
                    </>
                  )}
                </div>

                <div className="rh-data-row-status">
                  {esElDeAhora ? (
                    <span className="mc-status-pill mc-status-pill--aprobado">
                      Esta quincena{quincena ? ` (Q${quincena})` : ""}
                    </span>
                  ) : b.activo ? (
                    <span className="mc-status-pill mc-status-pill--pendiente">En rotación</span>
                  ) : (
                    <span className="mc-status-pill">Desactivado</span>
                  )}
                </div>

                <div className="rh-data-row-actions">
                  {editandoId === b.id ? (
                    <>
                      <button
                        type="button"
                        className="mc-btn-outline"
                        onClick={() => guardarNombre(b)}
                        disabled={enCurso}
                      >
                        {enCurso ? "Guardando…" : "Guardar"}
                      </button>
                      <button
                        type="button"
                        className="mc-btn-outline"
                        onClick={() => setEditandoId(null)}
                        disabled={enCurso}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="mc-btn-outline"
                        onClick={() => { setEditandoId(b.id); setNombreTemp(b.nombre); }}
                        disabled={enCurso}
                      >
                        <Icon name="wand" size={14} /> Renombrar
                      </button>
                      <button
                        type="button"
                        className="mc-btn-outline"
                        onClick={() => mover(b, -1)}
                        disabled={enCurso || i === 0}
                        aria-label={`Adelantar ${b.nombre} en la rotación`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="mc-btn-outline"
                        onClick={() => mover(b, 1)}
                        disabled={enCurso || i === ordenados.length - 1}
                        aria-label={`Retrasar ${b.nombre} en la rotación`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="mc-btn-outline"
                        onClick={() => alternarActivo(b)}
                        disabled={enCurso}
                      >
                        {b.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        className="mc-btn-outline mc-btn-outline--danger"
                        onClick={() => borrar(b)}
                        disabled={enCurso}
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
