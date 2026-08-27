import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import PageHeader from "../common/PageHeader";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import HtmlSeguro from "../common/HtmlSeguro";
import { useNotification } from "../../contexts/NotificationContext";
import { useGlobal } from "../../contexts/GlobalContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { etiquetaRol } from "../../utils/constants";
import {
  getAjustes,
  setAvisosSegundos,
  AVISOS_SEGUNDOS_DEFECTO,
  AVISOS_SEGUNDOS_MAX,
} from "../../services/supabase/ajustesService";

// El editor enriquecido (TipTap) se carga solo al abrir el panel de avisos (gestión), no en el
// bundle de empleados/doctores que solo LEEN los avisos.
const EditorTexto = lazy(() => import("../common/EditorTexto"));

const ROLES_GESTION = ["admin", "rh", "psicologa"];

const formatoFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

/**
 * Ajuste global de la espera del botón "De acuerdo" (migración 084). Solo lo ve y lo guarda
 * admin: la RLS de `ajustes` rechaza el UPDATE de cualquier otro rol, así que ofrecérselo a
 * RH sería un formulario condenado a fallar al guardar.
 */
const EsperaAviso = ({ userId }) => {
  const { toast } = useNotification();
  const [segundos, setSegundos] = useState("");
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    getAjustes().then((a) => {
      if (!activo) return;
      setSegundos(String(a.avisosSegundos ?? AVISOS_SEGUNDOS_DEFECTO));
      setCargado(true);
    });
    return () => { activo = false; };
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      const a = await setAvisosSegundos(segundos, userId);
      setSegundos(String(a.avisosSegundos));
      toast.success(
        a.avisosSegundos === 0
          ? "El botón «De acuerdo» ya no hace esperar."
          : `Ahora hay que esperar ${a.avisosSegundos} segundos antes de poder aceptar un aviso.`
      );
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar el tiempo de espera.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="aviso-espera-card">
      <div className="aviso-espera-texto">
        <div className="aviso-espera-titulo">
          <Icon name="clock" size={16} />
          Espera antes de poder aceptar
        </div>
        <p className="aviso-espera-hint">
          <span>
            Segundos que el botón «De acuerdo» permanece bloqueado al abrirse un aviso, para dar
            tiempo de leerlo. 0 lo habilita de inmediato; el máximo son {AVISOS_SEGUNDOS_MAX}.
          </span>
        </p>
      </div>
      <div className="aviso-espera-control">
        <input
          className="mc-form-input aviso-espera-input"
          type="number"
          min={0}
          max={AVISOS_SEGUNDOS_MAX}
          step={5}
          value={segundos}
          disabled={!cargado || guardando}
          onChange={(e) => setSegundos(e.target.value)}
          aria-label="Segundos de espera"
        />
        <span className="aviso-espera-unidad">seg</span>
        <button
          type="button"
          className="mc-btn-outline"
          disabled={!cargado || guardando}
          onClick={guardar}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Card>
  );
};

/**
 * Historial de avisos: lo ve cualquier rol, con el comunicado COMPLETO y firmado — quién lo
 * publicó y con qué rol, que viene de columnas del propio aviso (migración 084) porque la RLS
 * de `usuarios` no deja a un empleado leer la fila del autor.
 *
 * Solo admin/rh/psicologa tienen el botón de publicar y los de editar/eliminar; RLS lo
 * respalda del lado del servidor (migración 058), esto solo evita ofrecerle a un empleado un
 * botón que de todos modos le rechazaría la base. El formulario vive en un panel deslizante
 * para que la pantalla abra con los avisos y no con un formulario de tres cuartos de alto.
 */
// MP4 y 200 MB: mismo tope que hace cumplir el bucket (migraciones 129/130). Se valida acá
// también para avisar de inmediato, sin esperar a que la subida entera falle al final.
const VIDEO_TAM_MAX = 209715200;

const AvisosPanel = ({ user, avisos = [], onAdd, onUpdate, onDelete, onSubirVideo, onQuitarVideo }) => {
  const { toast, confirm } = useNotification();
  const { nombresSucursales } = useGlobal();
  const puedeGestionar = ROLES_GESTION.includes(user?.role);

  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [sucursalesSel, setSucursalesSel] = useState([]);
  const [buscarSuc, setBuscarSuc] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Video adjunto: `videoFile` es lo recién elegido en el <input>, todavía sin subir (se
  // sube junto con el resto al enviar el formulario); `videoUrlActual` es el que ya estaba
  // guardado al editar. Nunca los dos "compiten": elegir uno nuevo reemplaza la vista previa
  // del guardado, y "Quitar video" borra cualquiera de los dos.
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrlActual, setVideoUrlActual] = useState(null);
  const [subiendoVideo, setSubiendoVideo] = useState(false);

  // useMemo, no una expresión suelta: sin esto, cada render (había uno de más por CADA
  // tecla del título/cuerpo, por compartir componente) creaba una URL de blob nueva sin
  // liberar la anterior. Con memo solo se crea una vez por archivo, y el efecto de abajo
  // libera esa única URL al cambiar o desmontar.
  const videoPreviewUrl = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : videoUrlActual),
    [videoFile, videoUrlActual]
  );
  useEffect(() => {
    if (!videoFile) return undefined;
    return () => URL.revokeObjectURL(videoPreviewUrl);
  }, [videoFile, videoPreviewUrl]);

  const elegirVideo = (archivo) => {
    if (!archivo) return;
    if (archivo.type !== "video/mp4") {
      toast.warning("Solo se aceptan videos en formato MP4.");
      return;
    }
    if (archivo.size > VIDEO_TAM_MAX) {
      toast.warning("El video pesa más de 200 MB. Comprímelo o recórtalo antes de subirlo.");
      return;
    }
    setVideoFile(archivo);
    // Confirmación visible y distinta de cualquier otro aviso — así se sabe que el archivo
    // sí quedó elegido, sin depender de fijarse en la vista previa.
    toast.success(`Video listo para publicar: ${archivo.name}`);
  };

  const quitarVideo = async () => {
    if (editandoId && videoUrlActual && !videoFile) {
      // Ya estaba guardado: hay que avisarle a la base, no solo limpiar la vista.
      const ok = await onQuitarVideo(editandoId, videoUrlActual);
      if (!ok) return;
    }
    setVideoFile(null);
    setVideoUrlActual(null);
  };

  const toggleSucursal = (s) =>
    setSucursalesSel((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const sucursalesFiltradas = nombresSucursales.filter((s) =>
    s.toLowerCase().includes(buscarSuc.trim().toLowerCase())
  );

  const cerrarPanel = () => {
    setAbierto(false);
    setTitulo("");
    setCuerpo("");
    setSucursalesSel([]);
    setBuscarSuc("");
    setEditandoId(null);
    setVideoFile(null);
    setVideoUrlActual(null);
  };

  // Mientras se guarda no se cierra con Escape ni con clic fuera: irse a media petición
  // dejaría el formulario en blanco sin saber si el aviso llegó a publicarse.
  useEscapeKey(cerrarPanel, abierto && !enviando);

  const abrirNuevo = () => {
    setTitulo("");
    setCuerpo("");
    setSucursalesSel([]);
    setBuscarSuc("");
    setEditandoId(null);
    setVideoFile(null);
    setVideoUrlActual(null);
    setAbierto(true);
  };

  const iniciarEdicion = (aviso) => {
    setTitulo(aviso.titulo);
    setCuerpo(aviso.cuerpo);
    setSucursalesSel(aviso.sucursales || []);
    setBuscarSuc("");
    setEditandoId(aviso.id);
    setVideoFile(null);
    setVideoUrlActual(aviso.videoUrl || null);
    setAbierto(true);
  };

  const enviar = async () => {
    if (!titulo.trim() || !cuerpo.trim()) {
      toast.warning("Completa el título y el cuerpo del aviso.");
      return;
    }
    if (sucursalesSel.length === 0) {
      toast.warning("No seleccionaste ninguna sucursal, elige al menos una para poder enviar el aviso.");
      return;
    }

    setEnviando(true);
    const datos = { titulo: titulo.trim(), cuerpo: cuerpo.trim(), sucursales: sucursalesSel };
    // onAdd devuelve el aviso creado (o null); onUpdate sigue devolviendo true/false — en
    // los dos casos se necesita saber a qué id subirle el video, si eligieron uno.
    const resultado = editandoId ? await onUpdate(editandoId, datos) : await onAdd(datos);
    const avisoId = editandoId || resultado?.id;
    const ok = editandoId ? resultado : !!resultado;

    // Nada de esto queda callado: si eligieron un video, alguna de las tres ramas de abajo
    // avisa qué pasó — antes, si `avisoId` salía vacío por lo que fuera, esto no hacía nada
    // y el video se perdía sin ningún mensaje.
    if (videoFile) {
      if (ok && avisoId) {
        setSubiendoVideo(true);
        const subido = await onSubirVideo(avisoId, videoFile);
        setSubiendoVideo(false);
        if (subido) toast.success("Video subido.");
        // Si falló, onSubirVideo ya mostró su propio aviso de error.
      } else if (ok) {
        toast.error("El aviso se guardó, pero no se pudo subir el video (no se encontró su id). Editalo para volver a intentarlo.");
      }
    }
    setEnviando(false);

    if (ok) {
      toast.success(editandoId ? "Aviso actualizado." : "Aviso publicado.");
      cerrarPanel();
    }
  };

  const eliminar = async (aviso) => {
    const ok = await confirm({
      title: "Eliminar aviso",
      description: `¿Seguro que quieres eliminar "${aviso.titulo}"? Ya no se le mostrará a nadie.`,
      variant: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;

    const eliminado = await onDelete(aviso.id);
    if (eliminado && editandoId === aviso.id) cerrarPanel();
  };

  // Portal a <body>: `.app-main` crea un stacking context que atrapa a un `position: fixed` y
  // lo deja por debajo de la barra de navegación (mismo motivo que el detalle de empleados).
  const panel = puedeGestionar && abierto
    ? createPortal(
        <div
          className="mc-slideout-overlay"
          onClick={enviando ? undefined : cerrarPanel}
          role="presentation"
        >
          <div
            className="mc-slideout-panel aviso-form-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editandoId ? "Editar aviso" : "Nuevo aviso"}
          >
            <button type="button" className="mc-slideout-close" onClick={cerrarPanel} aria-label="Cerrar">
              <Icon name="xCircle" size={22} />
            </button>

            <SectionTitle icon="bell">{editandoId ? "Editar aviso" : "Nuevo aviso"}</SectionTitle>

            <div className="mc-form-grid">
              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="aviso-titulo">Título</label>
                <input
                  id="aviso-titulo"
                  className="mc-form-input"
                  type="text"
                  maxLength={150}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Cambio de horario por puente"
                />
              </div>

              <div className="mc-form-group">
                <label className="mc-form-label">Cuerpo</label>
                <Suspense fallback={<div className="editor-cargando">Cargando editor…</div>}>
                  <EditorTexto value={cuerpo} onChange={setCuerpo} placeholder="Escribe el comunicado completo." />
                </Suspense>
              </div>

              <div className="mc-form-group">
                <label className="mc-form-label" htmlFor="aviso-video">Video (opcional)</label>
                <p className="mc-hint">MP4, máx. 200 MB. Se reproduce junto con el aviso.</p>
                {videoPreviewUrl ? (
                  <div className="aviso-video-preview">
                    <video controls src={videoPreviewUrl} className="aviso-video" />
                    <button
                      type="button"
                      className="mc-btn-outline"
                      disabled={enviando || subiendoVideo}
                      onClick={quitarVideo}
                    >
                      Quitar video
                    </button>
                  </div>
                ) : (
                  <input
                    id="aviso-video"
                    className="mc-form-input"
                    type="file"
                    accept="video/mp4"
                    disabled={enviando || subiendoVideo}
                    onChange={(e) => elegirVideo(e.target.files?.[0])}
                  />
                )}
                {subiendoVideo && <p className="mc-hint">Subiendo video…</p>}
              </div>

              <div className="mc-form-group">
                <label className="mc-form-label">Sucursales destino</label>
                <div className="aviso-suc-toolbar">
                  <input
                    className="mc-form-input aviso-suc-buscar"
                    type="text"
                    placeholder="Buscar sucursal…"
                    value={buscarSuc}
                    onChange={(e) => setBuscarSuc(e.target.value)}
                  />
                  <button type="button" className="mc-btn-outline" onClick={() => setSucursalesSel(nombresSucursales)}>
                    Seleccionar todas
                  </button>
                  <button type="button" className="mc-btn-outline" onClick={() => setSucursalesSel([])}>
                    Limpiar
                  </button>
                  <span className="aviso-suc-contador">{sucursalesSel.length} de {nombresSucursales.length}</span>
                </div>
                <div className="aviso-suc-chips">
                  {sucursalesFiltradas.map((s) => {
                    const activa = sucursalesSel.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`aviso-suc-chip${activa ? " aviso-suc-chip--activa" : ""}`}
                        aria-pressed={activa}
                        onClick={() => toggleSucursal(s)}
                      >
                        {s}
                      </button>
                    );
                  })}
                  {sucursalesFiltradas.length === 0 && <span className="mc-empty">Sin coincidencias.</span>}
                </div>
              </div>

              <div className="mc-form-row-2">
                <button type="button" className="mc-btn-primary mc-btn-with-icon" disabled={enviando} onClick={enviar}>
                  <Icon name={editandoId ? "check" : "bell"} size={16} />
                  {enviando ? "Guardando…" : editandoId ? "Guardar cambios" : "Publicar aviso"}
                </button>
                <button type="button" className="mc-btn-outline" disabled={enviando} onClick={cerrarPanel}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="admin-page">
      <PageHeader
        icon="bell"
        title="Avisos"
        subtitle="Comunicados de la clínica. Todos los ven al entrar; solo RH, psicología y admin los publican."
      >
        {puedeGestionar && (
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={abrirNuevo}>
            <Icon name="plus" size={16} />
            Nuevo aviso
          </button>
        )}
      </PageHeader>

      {user?.role === "admin" && <EsperaAviso userId={user?.id} />}

      {avisos.length === 0 ? (
        <Card><EmptyState icon="bell" message="Todavía no se ha publicado ningún aviso." /></Card>
      ) : (
        <div className="aviso-lista">
          {avisos.map((a) => {
            const rol = etiquetaRol(a.autorRol);
            return (
              <Card key={a.id} className="aviso-card">
                <div className="aviso-card-head">
                  <div className="aviso-card-encabezado">
                    <h3 className="aviso-card-titulo">{a.titulo}</h3>
                    <div className="aviso-card-firma">
                      <span className="aviso-card-autor">{a.autor || "Autor no disponible"}</span>
                      {rol && <span className="aviso-card-rol">{rol}</span>}
                      <span className="aviso-card-fecha">{formatoFecha(a.createdAt)}</span>
                    </div>
                  </div>
                  {puedeGestionar && (
                    <div className="aviso-card-acciones">
                      <button
                        type="button"
                        className="emp-table-icon-btn"
                        title="Editar aviso"
                        aria-label={`Editar ${a.titulo}`}
                        onClick={() => iniciarEdicion(a)}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        className="emp-table-icon-btn emp-table-icon-btn--danger"
                        title="Eliminar aviso"
                        aria-label={`Eliminar ${a.titulo}`}
                        onClick={() => eliminar(a)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <HtmlSeguro className="aviso-card-cuerpo aviso-html" html={a.cuerpo} />

                {a.videoUrl && <video controls src={a.videoUrl} className="aviso-video" />}

                {a.sucursales?.length > 0 && (
                  <div className="aviso-row-sucursales">
                    {a.sucursales.length === nombresSucursales.length ? (
                      <span className="aviso-suc-badge aviso-suc-badge--todas">Todas las sucursales</span>
                    ) : (
                      a.sucursales.map((s) => <span key={s} className="aviso-suc-badge">{s}</span>)
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {panel}
    </div>
  );
};

export default AvisosPanel;
