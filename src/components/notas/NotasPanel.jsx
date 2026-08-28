import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
import Icon from "../ui/Icon";
import { sanitizarHtml } from "../../utils/sanitizarHtml";
import { notify } from "../../utils/notify";
import {
  getNotas, addNota, updateNota, deleteNota,
  extraerWikilinks, guardarLinks, getBacklinks,
} from "../../services/supabase/notasPersonalesService";
import NotasGrafo from "./NotasGrafo";

// El editor (TipTap) solo se necesita al abrir Notas — igual que en Avisos, no vale la
// pena meterlo en el bundle inicial de quien nunca abre esta pantalla.
const EditorTexto = lazy(() => import("../common/EditorTexto"));

const ESPERA_AUTOGUARDADO_MS = 800;

const parseTags = (txt) => txt.split(",").map((t) => t.trim()).filter(Boolean);

const soloTexto = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const formatoFecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// Vuelve clicables los [[Título]] del cuerpo YA saneado (nunca antes: el saneo es lo que
// impide que un HTML malicioso pegado en la nota se ejecute; esto solo envuelve texto que
// ya pasó ese filtro, así que no puede colar una etiqueta nueva — el propio patrón excluye
// `<`/`>` dentro de los corchetes).
const conEnlaces = (html) =>
  sanitizarHtml(html).replace(/\[\[([^[\]<>]+)\]\]/g, (_, t) => {
    const titulo = t.trim();
    return `<button type="button" class="nota-wikilink" data-titulo="${escapeAttr(titulo)}">${titulo}</button>`;
  });

/**
 * Notas personales por usuario — 100% privadas (RLS, migración 131). Estilo Obsidian:
 * enlaces [[Entre corchetes]] entre notas, backlinks y un grafo de conexiones.
 */
export default function NotasPanel({ user }) {
  const [notas, setNotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [activaId, setActivaId] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [carpeta, setCarpeta] = useState("");
  const [tagsTexto, setTagsTexto] = useState("");
  const [modoVista, setModoVista] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCarpeta, setFiltroCarpeta] = useState("");
  const [backlinks, setBacklinks] = useState([]);
  const [grafoAbierto, setGrafoAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Los refs guardan SIEMPRE el último valor: el timeout del autoguardado se agenda una
  // vez y, si se ejecuta varios renders después, necesita ver lo que hay ahora, no lo que
  // había cuando se programó.
  const edicionRef = useRef({ titulo: "", cuerpo: "", carpeta: "", tagsTexto: "" });
  const activaIdRef = useRef(null);
  const timerRef = useRef(null);
  const saltarRef = useRef(false); // evita re-guardar la nota justo después de cargarla

  useEffect(() => { edicionRef.current = { titulo, cuerpo, carpeta, tagsTexto }; }, [titulo, cuerpo, carpeta, tagsTexto]);
  useEffect(() => { activaIdRef.current = activaId; }, [activaId]);

  useEffect(() => {
    getNotas()
      .then(setNotas)
      .catch(() => notify.toast.error("No se pudieron cargar tus notas."))
      .finally(() => setCargando(false));
  }, []);

  const ejecutarGuardado = async () => {
    const id = activaIdRef.current;
    if (!id) return;
    const { titulo: t, cuerpo: c, carpeta: cp, tagsTexto: tt } = edicionRef.current;
    if (!t.trim()) return; // no guarda un título vacío a medio borrar
    setGuardando(true);
    try {
      const actualizada = await updateNota({ id, titulo: t.trim(), cuerpo: c, carpeta: cp.trim() || null, tags: parseTags(tt) });
      setNotas((prev) => prev.map((n) => (n.id === id ? actualizada : n)));
      await guardarLinks(id, extraerWikilinks(c), user.id);
      const bl = await getBacklinks(actualizada.titulo);
      setBacklinks(bl.filter((n) => n.id !== id));
    } catch (e) {
      notify.toast.error(e?.message || "No se pudo guardar la nota.");
    } finally {
      setGuardando(false);
    }
  };

  const flush = () => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    ejecutarGuardado();
  };

  useEffect(() => {
    if (saltarRef.current) { saltarRef.current = false; return; }
    if (!activaId) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; ejecutarGuardado(); }, ESPERA_AUTOGUARDADO_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, cuerpo, carpeta, tagsTexto]);

  const seleccionar = (nota) => {
    if (nota.id === activaId) return;
    flush(); // guarda lo pendiente de la nota anterior antes de cambiar de nota
    saltarRef.current = true;
    setActivaId(nota.id);
    setTitulo(nota.titulo);
    setCuerpo(nota.cuerpo);
    setCarpeta(nota.carpeta || "");
    setTagsTexto((nota.tags || []).join(", "));
    setModoVista(false);
    setBacklinks([]);
    getBacklinks(nota.titulo).then((bl) => setBacklinks(bl.filter((n) => n.id !== nota.id)));
  };

  const crear = async () => {
    const t = await notify.prompt({
      title: "Nueva nota",
      description: "Título de la nota:",
      placeholder: "Sin título",
      confirmText: "Crear",
    });
    if (t === null) return;
    const tituloNuevo = t.trim();
    if (!tituloNuevo) { notify.toast.warning("Ponle un título a la nota."); return; }
    try {
      const nueva = await addNota({ titulo: tituloNuevo, carpeta: filtroCarpeta || null });
      setNotas((prev) => [nueva, ...prev]);
      seleccionar(nueva);
    } catch (e) {
      notify.toast.error(e?.message || "No se pudo crear la nota.");
    }
  };

  const eliminar = async (nota) => {
    const ok = await notify.confirm({
      title: "Eliminar nota",
      description: `¿Seguro que quieres eliminar "${nota.titulo}"? No se puede deshacer.`,
      variant: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    if (activaId === nota.id) { clearTimeout(timerRef.current); timerRef.current = null; }
    try {
      await deleteNota(nota.id);
      setNotas((prev) => prev.filter((n) => n.id !== nota.id));
      if (activaId === nota.id) {
        setActivaId(null); setTitulo(""); setCuerpo(""); setCarpeta(""); setTagsTexto(""); setBacklinks([]);
      }
      notify.toast.success("Nota eliminada.");
    } catch (e) {
      notify.toast.error(e?.message || "No se pudo eliminar la nota.");
    }
  };

  const irANota = async (tituloDestino) => {
    flush();
    const existente = notas.find((n) => n.titulo.toLowerCase() === tituloDestino.toLowerCase());
    if (existente) { seleccionar(existente); return; }
    const crearla = await notify.confirm({
      title: "Nota no encontrada",
      description: `Todavía no existe una nota llamada "${tituloDestino}". ¿Quieres crearla?`,
      confirmText: "Crear nota",
    });
    if (!crearla) return;
    try {
      const nueva = await addNota({ titulo: tituloDestino });
      setNotas((prev) => [nueva, ...prev]);
      seleccionar(nueva);
    } catch (e) {
      notify.toast.error(e?.message || "No se pudo crear la nota.");
    }
  };

  const carpetas = useMemo(
    () => [...new Set(notas.map((n) => n.carpeta).filter(Boolean))].sort(),
    [notas]
  );

  const notasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return notas.filter((n) => {
      if (filtroCarpeta && n.carpeta !== filtroCarpeta) return false;
      if (q && !n.titulo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notas, busqueda, filtroCarpeta]);

  const notaActiva = notas.find((n) => n.id === activaId);

  return (
    <div className="notas-page">
      <PageHeader icon="note" title="Notas" subtitle="Tu libreta personal — 100% privada, nadie más la ve.">
        <button type="button" className="mc-btn-secondary" onClick={() => setGrafoAbierto(true)} disabled={notas.length < 1}>
          <Icon name="link" size={16} /> Ver grafo
        </button>
        <button type="button" className="mc-btn-primary" onClick={crear}>
          <Icon name="plus" size={16} /> Nueva nota
        </button>
      </PageHeader>

      {cargando ? (
        <EmptyState icon="note" title="Cargando…" message="Un momento, cargando tus notas." />
      ) : (
        <div className="notas-layout">
          <Card className="notas-sidebar-card">
            <div className="notas-sidebar-head">
              <input
                type="text"
                className="notas-buscador"
                placeholder="Buscar por título…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {carpetas.length > 0 && (
                <select className="notas-filtro-carpeta" value={filtroCarpeta} onChange={(e) => setFiltroCarpeta(e.target.value)}>
                  <option value="">Todas las carpetas</option>
                  {carpetas.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div className="notas-lista">
              {notasFiltradas.length === 0 ? (
                <EmptyState icon="note" title="Sin notas todavía" message="Crea tu primera nota con el botón de arriba." />
              ) : (
                notasFiltradas.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`notas-item${n.id === activaId ? " notas-item--activa" : ""}`}
                    onClick={() => seleccionar(n)}
                  >
                    <span className="notas-item-titulo">{n.titulo}</span>
                    <span className="notas-item-extracto">{soloTexto(n.cuerpo).slice(0, 80) || "Sin contenido"}</span>
                    <span className="notas-item-meta">
                      {n.carpeta && <span className="notas-item-carpeta"><Icon name="folder" size={12} /> {n.carpeta}</span>}
                      <span>{formatoFecha(n.updatedAt)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="notas-editor-card">
            {!notaActiva ? (
              <EmptyState icon="note" title="Elige o crea una nota" message="Selecciona una nota de la lista o crea una nueva para empezar a escribir." />
            ) : (
              <>
                <div className="notas-editor-head">
                  <input
                    type="text"
                    className="notas-titulo-input"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Título de la nota"
                  />
                  <div className="notas-editor-acciones">
                    <span className="notas-guardado-estado">{guardando ? "Guardando…" : "Guardado"}</span>
                    <button type="button" className="mc-btn-secondary" onClick={() => setModoVista((v) => !v)}>
                      <Icon name={modoVista ? "edit" : "eye"} size={16} /> {modoVista ? "Editar" : "Vista previa"}
                    </button>
                    <button
                      type="button"
                      className="emp-table-icon-btn emp-table-icon-btn--danger"
                      title="Eliminar nota"
                      aria-label={`Eliminar ${notaActiva.titulo}`}
                      onClick={() => eliminar(notaActiva)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>

                {modoVista ? (
                  <div
                    className="nota-vista"
                    dangerouslySetInnerHTML={{ __html: conEnlaces(cuerpo) }}
                    onClick={(e) => {
                      const btn = e.target.closest(".nota-wikilink");
                      if (btn) irANota(btn.dataset.titulo);
                    }}
                  />
                ) : (
                  <Suspense fallback={<div className="editor-cargando">Cargando editor…</div>}>
                    <EditorTexto value={cuerpo} onChange={setCuerpo} placeholder="Escribe aquí… usa [[Título]] para enlazar otra nota." />
                  </Suspense>
                )}

                <div className="notas-panel-extra">
                  <label className="notas-campo-carpeta">
                    <Icon name="folder" size={14} /> Carpeta
                    <input type="text" value={carpeta} onChange={(e) => setCarpeta(e.target.value)} placeholder="Sin carpeta" />
                  </label>
                  <label className="notas-campo-tags">
                    Etiquetas (separadas por coma)
                    <input type="text" value={tagsTexto} onChange={(e) => setTagsTexto(e.target.value)} placeholder="trabajo, ideas…" />
                  </label>
                  {backlinks.length > 0 && (
                    <div className="notas-backlinks">
                      <span className="notas-backlinks-titulo">Notas que enlazan aquí</span>
                      {backlinks.map((n) => (
                        <button key={n.id} type="button" className="notas-backlink-item" onClick={() => seleccionar(n)}>
                          <Icon name="link" size={13} /> {n.titulo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {grafoAbierto && (
        <NotasGrafo notas={notas} onCerrar={() => setGrafoAbierto(false)} onIrANota={(n) => { setGrafoAbierto(false); seleccionar(n); }} />
      )}
    </div>
  );
}
