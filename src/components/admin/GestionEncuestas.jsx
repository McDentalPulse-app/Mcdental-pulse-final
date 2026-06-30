import React, { useMemo, useState } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { semanaDisplay, isSemanaActual } from "../../utils/constants";
import {
  normalizePreguntasList,
  normalizePregunta,
  DEFAULT_OPCIONES_RIESGO,
} from "../../utils/encuestaPreguntas";
import { saveEncuestaPreguntas } from "../../services/firestore/encuestaPreguntasService";

const TIPOS = [
  { value: "escala", label: "Escala (1–10)" },
  { value: "sino", label: "Sí / No" },
  { value: "opcion", label: "Opción múltiple" },
  { value: "abierta", label: "Respuesta abierta" },
];

const ADVERTENCIA_ENCUESTA =
  "Importante: modificar las preguntas puede afectar el cálculo del Pulse Score, los semáforos, los riesgos IA y la comparación histórica entre semanas. Los cambios aplicarán únicamente a próximas respuestas; las encuestas ya contestadas no se modifican.";

const serializarPreguntas = (list) =>
  JSON.stringify(
    normalizePreguntasList(list).map((p) => ({
      id: p.id,
      texto: p.texto,
      tipo: p.tipo,
      area: p.area,
      orden: p.orden,
      activa: p.activa !== false,
      ...(p.tipo === "opcion" ? { opciones: p.opciones || [] } : {}),
    }))
  );

const GestionEncuestas = ({ encuestas = [] }) => {
  const { encuestaPreguntas, setEncuestaPreguntas } = useGlobal();
  const { toast, confirm } = useNotification();

  const preguntasOrdenadas = useMemo(
    () => normalizePreguntasList(encuestaPreguntas),
    [encuestaPreguntas]
  );

  const respuestasSemana = new Set(
    encuestas.filter((e) => isSemanaActual(e.semana)).map((e) => e.empleadoId)
  ).size;

  const [modalAbierto, setModalAbierto] = useState(false);
  const [draftPreguntas, setDraftPreguntas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const hayCambiosReales =
    modalAbierto &&
    serializarPreguntas(draftPreguntas) !== serializarPreguntas(encuestaPreguntas);

  const abrirEditor = () => {
    setDraftPreguntas(normalizePreguntasList(encuestaPreguntas));
    setEditandoId(null);
    setForm(null);
    setModalAbierto(true);
  };

  const cerrarEditor = () => {
    if (guardando) return;
    setModalAbierto(false);
    setEditandoId(null);
    setForm(null);
  };

  const iniciarEdicion = (pregunta) => {
    setEditandoId(pregunta.id);
    setForm({
      ...pregunta,
      opcionesTexto:
        pregunta.tipo === "opcion"
          ? (pregunta.opciones || DEFAULT_OPCIONES_RIESGO).join("\n")
          : "",
    });
  };

  const cancelarEdicionPregunta = () => {
    setEditandoId(null);
    setForm(null);
  };

  const aplicarEdicionPregunta = () => {
    if (!form?.texto?.trim()) {
      toast.warning("El texto de la pregunta es obligatorio.");
      return;
    }

    const actualizada = normalizePregunta(
      {
        ...form,
        texto: form.texto.trim(),
        orden: Number(form.orden) || form.id,
        activa: form.activa !== false,
        opciones:
          form.tipo === "opcion"
            ? String(form.opcionesTexto || "")
                .split("\n")
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      },
      form.id - 1
    );

    if (actualizada.tipo === "opcion" && !actualizada.opciones?.length) {
      toast.warning("Agrega al menos una opción para preguntas de tipo opción.");
      return;
    }

    setDraftPreguntas((prev) =>
      normalizePreguntasList(
        prev.map((p) => (p.id === actualizada.id ? { ...p, ...actualizada } : p))
      )
    );
    setEditandoId(null);
    setForm(null);
  };

  const handleTipoChange = (tipo) => {
    setForm((prev) => ({
      ...prev,
      tipo,
      opcionesTexto:
        tipo === "opcion"
          ? prev.opcionesTexto || DEFAULT_OPCIONES_RIESGO.join("\n")
          : "",
    }));
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const ordenadas = normalizePreguntasList(draftPreguntas);
      const guardadas = await saveEncuestaPreguntas(ordenadas);
      setEncuestaPreguntas(normalizePreguntasList(guardadas));
      toast.success("Preguntas de encuesta guardadas correctamente.");
      cerrarEditor();
    } catch (error) {
      toast.error(error.message || "No se pudieron guardar los cambios en Firebase.");
    } finally {
      setGuardando(false);
    }
  };

  const solicitarGuardar = async () => {
    if (!hayCambiosReales) {
      toast.info("No hay cambios por guardar.");
      return;
    }

    const confirmar = await confirm({
      title: "Confirmar cambios en encuesta",
      description:
        "Estos cambios pueden afectar la interpretación de resultados futuros. Las respuestas anteriores se conservarán sin cambios. ¿Deseas continuar?",
      confirmText: "Sí, guardar cambios",
      cancelText: "Cancelar",
      variant: "warning",
    });

    if (!confirmar) return;
    await guardarCambios();
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Gestión de Encuestas</h1>
        <p className="admin-page-subtitle">Encuesta activa y preguntas del periodo actual.</p>
      </div>

      <Card className="encuesta-page-card">
        <SectionTitle icon="clipboard">Encuesta semanal activa</SectionTitle>
        <div className="encuesta-meta">
          <span className="encuesta-meta-item">
            <Icon name="calendar" size={14} /> Semana {semanaDisplay}
          </span>
          <span className="encuesta-meta-item">
            <Icon name="clipboard" size={14} /> {preguntasOrdenadas.length} preguntas
          </span>
          <span className="encuesta-meta-item">
            <Icon name="users" size={14} /> {respuestasSemana} respuestas
          </span>
        </div>

        <div className="encuesta-list">
          {preguntasOrdenadas.map((p, i) => (
            <div key={p.id} className={`encuesta-item${p.activa === false ? " encuesta-item--inactive" : ""}`}>
              <span className="encuesta-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="encuesta-text">{p.texto}</span>
              <span className="encuesta-tipo">{p.tipo}</span>
            </div>
          ))}
        </div>

        <div className="encuesta-edit-warning" role="note">
          <Icon name="alert" size={16} />
          <span>{ADVERTENCIA_ENCUESTA}</span>
        </div>

        <div className="encuesta-footer">
          <button
            type="button"
            className="mc-btn-primary mc-btn-with-icon"
            onClick={abrirEditor}
          >
            <Icon name="wand" size={16} /> Editar preguntas
          </button>
        </div>
      </Card>

      {modalAbierto && (
        <div className="mc-modal-overlay encuesta-edit-overlay" onClick={cerrarEditor}>
          <div
            className="mc-modal encuesta-edit-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="encuesta-edit-title"
          >
            <div className="encuesta-edit-header">
              <div>
                <h2 id="encuesta-edit-title" className="mc-modal-title">Editar preguntas</h2>
                <p className="admin-page-subtitle encuesta-edit-sub">
                  Semana {semanaDisplay} · {draftPreguntas.length} preguntas
                </p>
              </div>
              <button type="button" className="encuesta-edit-close" onClick={cerrarEditor} aria-label="Cerrar">
                <Icon name="xCircle" size={20} />
              </button>
            </div>

            <div className="encuesta-edit-warning encuesta-edit-warning--modal" role="note">
              <Icon name="alert" size={16} />
              <span>{ADVERTENCIA_ENCUESTA}</span>
            </div>

            {editandoId == null ? (
              <div className="encuesta-edit-list">
                {normalizePreguntasList(draftPreguntas).map((p, i) => (
                  <div key={p.id} className="encuesta-edit-row">
                    <div className="encuesta-edit-row-main">
                      <span className="encuesta-num">{String(i + 1).padStart(2, "0")}</span>
                      <div className="encuesta-edit-row-text">
                        <div className="encuesta-edit-row-title">{p.texto}</div>
                        <div className="encuesta-edit-row-meta">
                          <span className="encuesta-tipo">{p.tipo}</span>
                          <span className="encuesta-edit-status">
                            {p.activa === false ? "Inactiva" : "Activa"}
                          </span>
                          <span className="encuesta-edit-orden">Orden {p.orden}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mc-btn-outline mc-btn-with-icon encuesta-edit-row-btn"
                      onClick={() => iniciarEdicion(p)}
                    >
                      <Icon name="wand" size={14} /> Editar
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="encuesta-edit-form">
                <h3 className="encuesta-edit-form-title">Editar pregunta #{form?.id}</h3>

                <div className="mc-form-group">
                  <label className="mc-form-label">Texto de la pregunta</label>
                  <textarea
                    className="mc-form-textarea"
                    rows={3}
                    value={form?.texto || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, texto: e.target.value }))}
                  />
                </div>

                <div className="mc-form-row-2">
                  <div className="mc-form-group">
                    <label className="mc-form-label">Tipo</label>
                    <select
                      className="mc-form-select"
                      value={form?.tipo || "escala"}
                      onChange={(e) => handleTipoChange(e.target.value)}
                    >
                      {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mc-form-group">
                    <label className="mc-form-label">Orden</label>
                    <input
                      type="number"
                      min={1}
                      className="mc-form-input"
                      value={form?.orden ?? form?.id ?? 1}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, orden: Number(e.target.value) || 1 }))
                      }
                    />
                  </div>
                </div>

                <div className="mc-form-group">
                  <label className="mc-form-label">Área</label>
                  <input
                    className="mc-form-input"
                    value={form?.area || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
                  />
                </div>

                <div className="mc-form-group">
                  <label className="mc-form-label">Estado</label>
                  <select
                    className="mc-form-select"
                    value={form?.activa === false ? "inactiva" : "activa"}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        activa: e.target.value === "activa",
                      }))
                    }
                  >
                    <option value="activa">Activa</option>
                    <option value="inactiva">Inactiva</option>
                  </select>
                </div>

                {form?.tipo === "opcion" && (
                  <div className="mc-form-group">
                    <label className="mc-form-label">Opciones (una por línea)</label>
                    <textarea
                      className="mc-form-textarea"
                      rows={4}
                      value={form.opcionesTexto || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, opcionesTexto: e.target.value }))
                      }
                      placeholder={"No\nAlgo\nSí, seriamente"}
                    />
                  </div>
                )}

                {form?.tipo === "escala" && (
                  <p className="encuesta-edit-type-hint">Escala fija de 1 a 10 en Mi Encuesta.</p>
                )}

                {form?.tipo === "sino" && (
                  <p className="encuesta-edit-type-hint">Opciones fijas: Sí y No.</p>
                )}

                {form?.tipo === "abierta" && (
                  <p className="encuesta-edit-type-hint">El empleado responderá en un campo de texto libre.</p>
                )}

                <div className="encuesta-edit-form-actions">
                  <button type="button" className="mc-btn-secondary" onClick={cancelarEdicionPregunta}>
                    Volver a la lista
                  </button>
                  <button type="button" className="mc-btn-primary" onClick={aplicarEdicionPregunta}>
                    Aplicar cambios
                  </button>
                </div>
              </div>
            )}

            {editandoId == null && (
              <div className="encuesta-edit-footer">
                <button type="button" className="mc-btn-secondary" onClick={cerrarEditor} disabled={guardando}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="mc-btn-primary mc-btn-with-icon"
                  onClick={solicitarGuardar}
                  disabled={guardando || !hayCambiosReales}
                >
                  <Icon name="check" size={16} />
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionEncuestas;
