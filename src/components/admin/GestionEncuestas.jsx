import { useMemo, useState } from "react";
import Select from "../common/Select";
import { useGlobal } from "../../contexts/GlobalContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import PageHeader from "../common/PageHeader";
import GestionBloques from "./GestionBloques";
import Icon from "../ui/Icon";
import { periodoActual, esPeriodoActual, getISOWeek } from "../../utils/constants";
import { etiquetaDePeriodo } from "../../utils/periodos";
import {
  bloqueDeLaSemana,
  preguntasDeLaSemana,
  esAreaReservada,
  preguntaTieneRespuestas,
  AREAS_RESERVADAS,
} from "../../utils/encuestaBloques";
import {
  normalizePreguntasList,
  normalizePregunta,
  normalizePeso,
  extremosDeEscala,
  DEFAULT_OPCIONES_RIESGO,
} from "../../utils/encuestaPreguntas";
import { saveEncuestaPreguntas } from "../../services/supabase/encuestaPreguntasService";
import { getEncuestaPreguntas } from "../../services/supabase/usuariosService";

const TIPOS = [
  { value: "escala", label: "Escala (1–10)" },
  { value: "sino", label: "Sí / No" },
  { value: "opcion", label: "Opción múltiple" },
  { value: "abierta", label: "Respuesta abierta" },
];

// Cuánto cuenta una pregunta en el Pulse Score. Los valores son los del CHECK de la columna
// `peso` (migración 159): enteros del 1 al 5.
// Hacia dónde va una escala de 1 a 10. Las palabras salen de `extremosDeEscala`, que es la
// misma fuente que usa la pantalla del empleado: aquí se elige la frase que allí se lee.
const DIRECCIONES = [false, true].map((invertida) => {
  const { uno, diez } = extremosDeEscala(invertida);
  return { value: invertida ? "invertida" : "normal", label: `1 = ${uno} · 10 = ${diez}` };
});

const PESOS = [
  { value: 1, label: "Normal — cuenta igual que las demás" },
  { value: 2, label: "Cuenta doble (x2)" },
  { value: 3, label: "Cuenta triple (x3)" },
  { value: 4, label: "Cuenta x4" },
  { value: 5, label: "Cuenta x5 — el máximo" },
];

// Id para una pregunta que todavía no existe en la base. Numérico a propósito:
// saveEncuestaPreguntas distingue "hay que actualizarla" de "hay que crearla" por el tipo
// del id, y los de la base son uuid (string). El contador evita que dos altas dentro del
// mismo milisegundo compartan id y React trate las dos filas como una sola.
let contadorNuevas = 0;
const nuevoIdLocal = () => Date.now() + contadorNuevas++;

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
      bloqueId: p.bloqueId ?? null,
      peso: p.peso,
      invertida: p.invertida === true,
      ...(p.tipo === "opcion" ? { opciones: p.opciones || [] } : {}),
    }))
  );

const GestionEncuestas = ({ encuestas = [] }) => {
  const { encuestaPreguntas, setEncuestaPreguntas, encuestaBloques } = useGlobal();
  const { toast, confirm } = useNotification();

  const preguntasOrdenadas = useMemo(
    () => normalizePreguntasList(encuestaPreguntas),
    [encuestaPreguntas]
  );

  const respuestasSemana = new Set(
    encuestas.filter((e) => esPeriodoActual(e.semana)).map((e) => e.empleadoId)
  ).size;

  const [modalAbierto, setModalAbierto] = useState(false);
  const [draftPreguntas, setDraftPreguntas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  // Ids de preguntas de la BASE que se han sacado del borrador. Se borran al guardar, no al
  // pulsar: si se borrara en el acto, cerrar el modal con "Cancelar" no deshría nada.
  const [eliminadas, setEliminadas] = useState([]);

  // El bloque de esta quincena se DERIVA de la semana, no se guarda en ningún sitio.
  const bloqueActivo = bloqueDeLaSemana(getISOWeek(), encuestaBloques);

  // Una pregunta ya contestada tiene el texto y las opciones congelados: las respuestas se
  // guardan por ID, así que cambiar la frase reescribe el pasado en silencio — alguien
  // respondió "8" a una pregunta que ya no existe. Para reformularla, se desactiva y se crea
  // otra. El orden, el área y el estado sí se pueden seguir cambiando.
  // Mira la clave uuid Y la legacy: las encuestas migradas de Firestore guardaron la
  // respuesta bajo el id numérico viejo (ver el comentario de `respuestas` en la migración
  // 006). Preguntando solo por el uuid, la app daba por no contestadas justo las preguntas
  // con más histórico detrás — y ofrecía borrarlas.
  const tieneRespuestas = (pregunta) =>
    preguntaTieneRespuestas(pregunta?.id, encuestas) ||
    preguntaTieneRespuestas(pregunta?.legacyId, encuestas);

  const congelada = tieneRespuestas(form);

  // Se está creando ahora mismo: todavía no ha entrado al borrador.
  const esNueva = editandoId != null && !draftPreguntas.some((p) => p.id === editandoId);

  // Lo que el empleado va a ver esta semana: el núcleo más el bloque que toca. NO es lo
  // mismo que el catálogo completo, y confundirlos hacía que la tarjeta dijera "22
  // preguntas" cuando el empleado iba a contestar 10.
  const preguntasDeEstaSemana = preguntasDeLaSemana(preguntasOrdenadas, bloqueActivo);

  const hayCambiosReales =
    modalAbierto &&
    serializarPreguntas(draftPreguntas) !== serializarPreguntas(encuestaPreguntas);

  const abrirEditor = () => {
    setDraftPreguntas(normalizePreguntasList(encuestaPreguntas));
    setEditandoId(null);
    setForm(null);
    setEliminadas([]);
    setModalAbierto(true);
  };

  const cerrarEditor = () => {
    if (guardando) return;
    setModalAbierto(false);
    setEditandoId(null);
    setForm(null);
  };

  useEscapeKey(cerrarEditor, modalAbierto);

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

  // La pregunta nueva NO entra al borrador hasta que se aplica. Si entrara aquí, salir con
  // "Volver a la lista" dejaría una fila sin texto esperando a guardarse.
  const agregarPregunta = () => {
    const ordenMax = draftPreguntas.reduce(
      (max, p) => Math.max(max, Number(p.orden) || 0),
      0,
    );
    const nueva = normalizePregunta({
      id: nuevoIdLocal(),
      texto: "",
      tipo: "escala",
      area: "General",
      orden: ordenMax + 1,
    });

    setEditandoId(nueva.id);
    setForm({ ...nueva, opcionesTexto: "" });
  };

  const borrarPregunta = async (pregunta) => {
    // El editor congela el texto de una pregunta contestada por este mismo motivo: las
    // respuestas se guardan por ID, así que borrarla deja números que ningún reporte sabe ya
    // a qué pregunta pertenecen. La base lo impide igual (trigger de la migración 159);
    // esto ahorra el viaje y, sobre todo, explica qué hacer en su lugar.
    if (tieneRespuestas(pregunta)) {
      toast.error(
        "Alguien ya contestó esta pregunta, así que borrarla dejaría sus respuestas sin dueño. " +
          "Ponla en «Inactiva»: deja de aparecer en la encuesta y el histórico se conserva.",
      );
      return;
    }

    const ok = await confirm({
      title: "Eliminar pregunta",
      description:
        `¿Eliminar "${pregunta.texto}"? Nadie la ha contestado, así que no se pierde ningún ` +
        "dato. Se borra de la base al guardar los cambios.",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "danger",
    });
    if (!ok) return;

    setDraftPreguntas((prev) => prev.filter((p) => p.id !== pregunta.id));
    // Solo hay que borrar en la base las que existen allí. Las de id numérico nunca llegaron
    // a guardarse: sacarlas del borrador ya es todo el trabajo.
    if (typeof pregunta.id === "string") {
      setEliminadas((prev) => [...prev, pregunta.id]);
    }
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
        prev.some((p) => p.id === actualizada.id)
          ? prev.map((p) => (p.id === actualizada.id ? { ...p, ...actualizada } : p))
          : [...prev, actualizada]
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
    // Las áreas del núcleo están reservadas: el motor de riesgo localiza sus preguntas por
    // área, así que un bloque que usara "Riesgo" le robaría la fuente al riesgo de renuncia.
    const conflicto = draftPreguntas.find(
      (p) => p.bloqueId && esAreaReservada(p.area),
    );
    if (conflicto) {
      toast.error(
        `El área "${conflicto.area}" es del núcleo y no puede usarse en un bloque. ` +
          `Ponle otro nombre. Reservadas: ${AREAS_RESERVADAS.join(", ")}.`,
      );
      return;
    }

    // Sin ninguna escala activa en el núcleo no hay Pulse Score que calcular, y el trigger
    // rechaza TODA encuesta que llegue: la plantilla entera se quedaría sin poder enviar la
    // suya, con un error crudo de base de datos por toda explicación.
    const hayEscalaEnNucleo = draftPreguntas.some(
      (p) => !p.bloqueId && p.tipo === "escala" && p.activa !== false,
    );
    if (!hayEscalaEnNucleo) {
      toast.error(
        "La encuesta necesita al menos una pregunta de escala activa en el núcleo: es de donde sale el Pulse Score.",
      );
      return;
    }

    setGuardando(true);
    try {
      const ordenadas = normalizePreguntasList(draftPreguntas);
      const guardadas = await saveEncuestaPreguntas(ordenadas, eliminadas);
      setEncuestaPreguntas(normalizePreguntasList(guardadas));
      setEliminadas([]);
      toast.success("Preguntas de encuesta guardadas correctamente.");
      cerrarEditor();
    } catch (error) {
      toast.error(error.message || "No se pudieron guardar los cambios.");

      // El guardado puede haber fallado DESPUÉS de borrar: en ese caso el borrado sí ocurrió
      // y la lista en memoria se quedó con preguntas que ya no existen en la base. Sin releer,
      // al reabrir el editor el borrador partiría de esa lista vieja y el siguiente guardado
      // las RESUCITARÍA, porque el upsert las reinserta con su uuid original (y sin legacy_id).
      // Releer deja el borrador partiendo del estado real, que es el único desde el que el
      // reintento significa lo que parece.
      try {
        const frescas = normalizePreguntasList(await getEncuestaPreguntas());
        setEncuestaPreguntas(frescas);
        // De `eliminadas` solo sobran los borrados que la base YA aplicó, o sea los ids que
        // la relectura ya no encuentra. Los que siguen ahí NO se borraron —se cayó la red,
        // o el trigger los rechazó— y hay que conservarlos para que el reintento vuelva a
        // pedirlos. Vaciar la lista entera hacía que el segundo intento dejara de pedir el
        // borrado, el upsert funcionara y la app cantara «guardadas correctamente» con la
        // pregunta todavía viva en la base y ya desaparecida de la pantalla.
        setEliminadas((prev) => prev.filter((id) => frescas.some((p) => p.id === id)));
      } catch {
        // Si ni releer se puede, se deja lo que hay: del fallo ya se avisó arriba, y pisar
        // ese aviso con un segundo error solo taparía el primero.
      }
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
      <PageHeader
        icon="clipboard"
        title="Gestión de Encuestas"
        subtitle={
          bloqueActivo
            ? `Esta quincena, además del núcleo se pregunta el bloque "${bloqueActivo.nombre}".`
            : encuestaBloques.length
              ? "Esta quincena solo se pregunta el núcleo: no hay ningún bloque activo."
              : "Encuesta activa y preguntas del periodo actual."
        }
      />

      <GestionBloques />

      <Card className="encuesta-page-card">
        <SectionTitle icon="clipboard">Encuesta semanal activa</SectionTitle>
        <div className="encuesta-meta">
          <span className="encuesta-meta-item">
            <Icon name="calendar" size={14} /> {etiquetaDePeriodo(periodoActual)}
          </span>
          <span className="encuesta-meta-item">
            <Icon name="clipboard" size={14} /> {preguntasDeEstaSemana.length} preguntas esta semana
          </span>
          {preguntasOrdenadas.length !== preguntasDeEstaSemana.length && (
            <span className="encuesta-meta-item">
              <Icon name="folder" size={14} /> {preguntasOrdenadas.length} en el catálogo
            </span>
          )}
          <span className="encuesta-meta-item">
            <Icon name="users" size={14} /> {respuestasSemana} respuestas
          </span>
        </div>

        <div className="encuesta-list">
          {preguntasOrdenadas.map((p, i) => {
            // Esta lista es el catálogo completo (hay que poder editar las preguntas de
            // cualquier bloque), pero solo algunas se preguntan esta semana. Sin decirlo, el
            // listado parece la encuesta y no lo es.
            const suBloque = p.bloqueId
              ? encuestaBloques.find((b) => b.id === p.bloqueId)
              : null;
            const seHaceHoy = !p.bloqueId || p.bloqueId === bloqueActivo?.id;

            return (
              <div
                key={p.id}
                className={`encuesta-item${p.activa === false || !seHaceHoy ? " encuesta-item--inactive" : ""}`}
              >
                <span className="encuesta-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="encuesta-text">{p.texto}</span>
                <span className="encuesta-item-meta">
                  {suBloque && (
                    <span className="encuesta-bloque-tag">
                      {suBloque.nombre}
                      {!seHaceHoy && " · no esta quincena"}
                    </span>
                  )}
                  <span className="encuesta-tipo">{p.tipo}</span>
                </span>
              </div>
            );
          })}
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
                  {etiquetaDePeriodo(periodoActual)} · {draftPreguntas.length} preguntas
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
                          {!p.bloqueId && p.tipo === "escala" && p.peso > 1 && (
                            <span className="encuesta-edit-peso">Pesa x{p.peso}</span>
                          )}
                          {p.tipo === "escala" && p.invertida && (
                            <span className="encuesta-edit-invertida">1 = lo bueno</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="encuesta-edit-row-actions">
                      <button
                        type="button"
                        className="mc-btn-outline mc-btn-with-icon encuesta-edit-row-btn"
                        onClick={() => iniciarEdicion(p)}
                      >
                        <Icon name="wand" size={14} /> Editar
                      </button>
                      <button
                        type="button"
                        className="mc-btn-outline mc-btn-with-icon encuesta-edit-row-btn encuesta-edit-row-btn--danger"
                        onClick={() => borrarPregunta(p)}
                      >
                        <Icon name="trash" size={14} /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="encuesta-edit-form">
                <h3 className="encuesta-edit-form-title">
                  {esNueva ? "Nueva pregunta" : "Editar pregunta"}
                </h3>

                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="ge-texto">Texto de la pregunta</label>
                  <textarea
                    id="ge-texto"
                    className="mc-form-textarea"
                    rows={3}
                    value={form?.texto || ""}
                    disabled={congelada}
                    onChange={(e) => setForm((prev) => ({ ...prev, texto: e.target.value }))}
                  />
                  {congelada && (
                    <span className="mc-hint">
                      <Icon name="alert" size={14} />
                      Alguien ya contestó esta pregunta, así que su texto no se puede cambiar:
                      las respuestas quedarían atribuidas a una frase distinta. Para
                      reformularla, desactívala y crea una nueva.
                    </span>
                  )}
                </div>

                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="ge-bloque">Cuándo se pregunta</label>
                  <Select
                    id="ge-bloque"
                    value={form?.bloqueId || ""}
                    onChange={(valor) =>
                      setForm((prev) => ({ ...prev, bloqueId: valor || null }))
                    }
                  >
                    <option value="">Núcleo · todas las semanas (cuenta para el Pulse Score)</option>
                    {encuestaBloques.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre} · solo su quincena (no cuenta para el score)
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="mc-form-row-2">
                  <div className="mc-form-group">
                    <label className="mc-form-label" htmlFor="ge-tipo">Tipo</label>
                    <Select
                      id="ge-tipo"
                      value={form?.tipo || "escala"}
                      onChange={(valor) => handleTipoChange(valor)}
                    >
                      {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                  </div>

                  <div className="mc-form-group">
                    <label className="mc-form-label" htmlFor="ge-orden">Orden</label>
                    <input
                      id="ge-orden"
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
                  <label className="mc-form-label" htmlFor="ge-area">Área</label>
                  <input
                    id="ge-area"
                    className="mc-form-input"
                    value={form?.area || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
                  />
                </div>

                <div className="mc-form-group">
                  <label className="mc-form-label" htmlFor="ge-estado">Estado</label>
                  <Select
                    id="ge-estado"
                    value={form?.activa === false ? "inactiva" : "activa"}
                    onChange={(valor) =>
                      setForm((prev) => ({
                        ...prev,
                        activa: valor === "activa",
                      }))
                    }
                  >
                    <option value="activa">Activa</option>
                    <option value="inactiva">Inactiva</option>
                  </Select>
                </div>

                {/* La dirección se ofrece en TODA escala, también en las de bloque: aunque
                    esas no puntúen, el empleado ve la leyenda igual y necesita saber hacia
                    dónde contestar. */}
                {form?.tipo === "escala" && (
                  <div className="mc-form-group">
                    <label className="mc-form-label" htmlFor="ge-direccion">
                      Qué significa el 1 y qué el 10
                    </label>
                    <Select
                      id="ge-direccion"
                      value={form?.invertida ? "invertida" : "normal"}
                      onChange={(valor) =>
                        setForm((prev) => ({ ...prev, invertida: valor === "invertida" }))
                      }
                    >
                      {DIRECCIONES.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </Select>
                    <span className="mc-hint">
                      <Icon name="alert" size={14} />
                      Márcala invertida cuando un número alto sea algo MALO — «¿qué tan
                      estresado/a te has sentido?» es el caso típico. Sin esto, el Pulse
                      Score suma ese 10 como si fuera bienestar y premia a quien peor está.
                      El empleado ve esta misma frase debajo de los números.
                    </span>
                  </div>
                )}

                {/* Solo las escalas del núcleo puntúan, así que el peso solo significa algo
                    ahí. Enseñarlo en una abierta o en una de bloque prometería un efecto
                    que no existe. */}
                {form?.tipo === "escala" && !form?.bloqueId && (
                  <div className="mc-form-group">
                    <label className="mc-form-label" htmlFor="ge-peso">
                      Cuánto cuenta en el Pulse Score
                    </label>
                    <Select
                      id="ge-peso"
                      value={String(normalizePeso(form?.peso))}
                      onChange={(valor) =>
                        setForm((prev) => ({ ...prev, peso: Number(valor) }))
                      }
                    >
                      {PESOS.map((p) => (
                        <option key={p.value} value={String(p.value)}>{p.label}</option>
                      ))}
                    </Select>
                    <span className="mc-hint">
                      El score es el promedio ponderado de las escalas del núcleo. Subir el
                      peso de una pregunta la hace pesar más que el resto de aquí en
                      adelante; los scores ya guardados no se recalculan.
                    </span>
                  </div>
                )}

                {form?.tipo === "opcion" && (
                  <div className="mc-form-group">
                    <label className="mc-form-label" htmlFor="ge-opciones">Opciones (una por línea)</label>
                    <textarea
                      id="ge-opciones"
                      className="mc-form-textarea"
                      rows={4}
                      value={form.opcionesTexto || ""}
                      disabled={congelada}
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
                <button
                  type="button"
                  className="mc-btn-outline mc-btn-with-icon encuesta-edit-add"
                  onClick={agregarPregunta}
                  disabled={guardando}
                >
                  <Icon name="plus" size={16} /> Nueva pregunta
                </button>
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
