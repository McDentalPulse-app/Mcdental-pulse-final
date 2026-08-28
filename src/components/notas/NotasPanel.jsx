import { useState, useEffect, useRef, useMemo } from "react";
import { marked } from "marked";
import Card from "../common/Card";
import PageHeader from "../common/PageHeader";
import EmptyState from "../common/EmptyState";
import Icon from "../ui/Icon";
import { sanitizarHtmlNota } from "../../utils/sanitizarHtml";
import { notify } from "../../utils/notify";
import {
  getNotas, addNota, updateNota, deleteNota,
  extraerWikilinks, guardarLinks, getBacklinks,
} from "../../services/supabase/notasPersonalesService";
import NotasGrafo from "./NotasGrafo";

marked.setOptions({ breaks: true }); // un salto de línea sencillo ya separa párrafos, como en Obsidian

const ESPERA_AUTOGUARDADO_MS = 800;

const parseTags = (txt) => txt.split(",").map((t) => t.trim()).filter(Boolean);

// Extracto para la lista/búsqueda: quita la sintaxis markdown más común, no hace falta
// que sea perfecto — es solo una vista previa de una línea.
const soloTexto = (md) => (md || "")
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/\[\[([^[\]]+)\]\]/g, "$1")
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/[#>*_`~-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// Markdown -> HTML saneado, con los [[Título]] ya vueltos clicables. El saneo corre
// SIEMPRE antes de tocar el texto con el regex de wikilinks — nunca al revés — y ese
// regex no puede colar una etiqueta nueva porque excluye `<`/`>` dentro de los corchetes.
const renderNota = (markdown) =>
  sanitizarHtmlNota(marked.parse(markdown || "")).replace(/\[\[([^[\]<>]+)\]\]/g, (_, t) => {
    const titulo = t.trim();
    return `<button type="button" class="nota-wikilink" data-titulo="${escapeAttr(titulo)}">${titulo}</button>`;
  });

// Arma un árbol { carpetas: Map<nombre, nodo>, notas: [] } agrupando por `carpeta`
// partido en "/" — "Trabajo/Clientes" cuelga de Trabajo > Clientes. Sin carpeta = raíz.
const armarArbol = (notas) => {
  const raiz = { ruta: "", carpetas: new Map(), notas: [] };
  for (const n of notas) {
    const partes = (n.carpeta || "").split("/").map((p) => p.trim()).filter(Boolean);
    let actual = raiz;
    let ruta = "";
    for (const parte of partes) {
      ruta = ruta ? `${ruta}/${parte}` : parte;
      if (!actual.carpetas.has(parte)) actual.carpetas.set(parte, { ruta, nombre: parte, carpetas: new Map(), notas: [] });
      actual = actual.carpetas.get(parte);
    }
    actual.notas.push(n);
  }
  return raiz;
};

const porTitulo = (a, b) => a.titulo.localeCompare(b.titulo);

function RamaArbol({ nodo, nivel, abiertas, onToggle, activaId, onSeleccionar }) {
  const sub = [...nodo.carpetas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const notasOrdenadas = [...nodo.notas].sort(porTitulo);
  return (
    <>
      {sub.map((s) => {
        const abierta = abiertas.has(s.ruta);
        return (
          <div key={s.ruta}>
            <button
              type="button"
              className="notas-carpeta-fila"
              style={{ paddingLeft: 10 + nivel * 14 }}
              onClick={() => onToggle(s.ruta)}
            >
              <Icon name="chevronDown" size={13} className={`notas-carpeta-caret${abierta ? "" : " notas-carpeta-caret--cerrada"}`} />
              <Icon name="folder" size={14} />
              <span>{s.nombre}</span>
            </button>
            {abierta && (
              <RamaArbol nodo={s} nivel={nivel + 1} abiertas={abiertas} onToggle={onToggle} activaId={activaId} onSeleccionar={onSeleccionar} />
            )}
          </div>
        );
      })}
      {notasOrdenadas.map((n) => (
        <button
          key={n.id}
          type="button"
          className={`notas-item${n.id === activaId ? " notas-item--activa" : ""}`}
          style={{ paddingLeft: 28 + nivel * 14 }}
          onClick={() => onSeleccionar(n)}
        >
          <span className="notas-item-titulo">{n.titulo}</span>
        </button>
      ))}
    </>
  );
}

/**
 * Notas personales por usuario — 100% privadas (RLS, migración 131). Estilo Obsidian de
 * verdad: se escribe en markdown crudo (nada de barra de formato), [[Título]] enlaza
 * entre notas, backlinks, grafo, carpetas anidadas y los atajos de Obsidian
 * (Ctrl+B/I/K/E).
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
  const [carpetasAbiertas, setCarpetasAbiertas] = useState(() => new Set());
  const [backlinks, setBacklinks] = useState([]);
  const [grafoAbierto, setGrafoAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const textareaRef = useRef(null);
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

  // Ctrl/Cmd+E alterna Editar/Vista previa — igual que en Obsidian, funciona con el
  // panel abierto sin importar si el foco está en el textarea o no.
  useEffect(() => {
    if (!activaId) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") { e.preventDefault(); setModoVista((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activaId]);

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
      const nueva = await addNota({ titulo: tituloNuevo });
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

  // Atajos de Obsidian dentro del textarea: Ctrl/Cmd+B negrita, +I cursiva, +K enlace.
  // Envuelven la selección tal cual — sin selección, envuelven texto vacío y el cursor
  // queda listo entre los marcadores para empezar a escribir.
  const envolverSeleccion = (marcador) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: ini, selectionEnd: fin, value } = ta;
    const seleccion = value.slice(ini, fin);
    setCuerpo(value.slice(0, ini) + marcador + seleccion + marcador + value.slice(fin));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ini + marcador.length, fin + marcador.length); });
  };

  const insertarEnlace = async () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: ini, selectionEnd: fin, value } = ta;
    const seleccion = value.slice(ini, fin);
    const url = await notify.prompt({ title: "Enlace", description: "Pega la URL:", placeholder: "https://…", confirmText: "Aplicar" });
    if (url === null) return;
    const href = url.trim() ? (/^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`) : "";
    const texto = `[${seleccion || "enlace"}](${href})`;
    setCuerpo(value.slice(0, ini) + texto + value.slice(fin));
    requestAnimationFrame(() => { ta.focus(); const pos = ini + texto.length; ta.setSelectionRange(pos, pos); });
  };

  const onKeyDownEditor = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const tecla = e.key.toLowerCase();
    if (tecla === "b") { e.preventDefault(); envolverSeleccion("**"); }
    else if (tecla === "i") { e.preventDefault(); envolverSeleccion("*"); }
    else if (tecla === "k") { e.preventDefault(); insertarEnlace(); }
  };

  const toggleCarpeta = (ruta) => {
    setCarpetasAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(ruta)) next.delete(ruta); else next.add(ruta);
      return next;
    });
  };

  const arbol = useMemo(() => armarArbol(notas), [notas]);

  const notasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return notas.filter((n) => n.titulo.toLowerCase().includes(q)).sort(porTitulo);
  }, [notas, busqueda]);

  const notaActiva = notas.find((n) => n.id === activaId);

  return (
    <div className="notas-page">
      <PageHeader icon="note" title="Notas" subtitle="Tu libreta personal — 100% privada, nadie más la ve. Se escribe en markdown.">
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
            </div>
            <div className="notas-arbol">
              {notas.length === 0 ? (
                <EmptyState icon="note" title="Sin notas todavía" message="Crea tu primera nota con el botón de arriba." />
              ) : busqueda.trim() ? (
                notasFiltradas.length === 0 ? (
                  <p className="notas-sin-resultados">Nada coincide con "{busqueda}".</p>
                ) : (
                  notasFiltradas.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`notas-item${n.id === activaId ? " notas-item--activa" : ""}`}
                      onClick={() => seleccionar(n)}
                    >
                      <span className="notas-item-titulo">{n.titulo}</span>
                      <span className="notas-item-extracto">{soloTexto(n.cuerpo).slice(0, 70) || "Sin contenido"}</span>
                    </button>
                  ))
                )
              ) : (
                <RamaArbol nodo={arbol} nivel={0} abiertas={carpetasAbiertas} onToggle={toggleCarpeta} activaId={activaId} onSeleccionar={seleccionar} />
              )}
            </div>
          </Card>

          <Card className="notas-editor-card">
            {!notaActiva ? (
              <EmptyState icon="note" title="Elige o crea una nota" message="Selecciona una nota del árbol o crea una nueva para empezar a escribir." />
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
                    <button type="button" className="mc-btn-secondary" onClick={() => setModoVista((v) => !v)} title="Ctrl+E">
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
                    dangerouslySetInnerHTML={{ __html: renderNota(cuerpo) }}
                    onClick={(e) => {
                      const btn = e.target.closest(".nota-wikilink");
                      if (btn) irANota(btn.dataset.titulo);
                    }}
                  />
                ) : (
                  <textarea
                    ref={textareaRef}
                    className="notas-editor-textarea"
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                    onKeyDown={onKeyDownEditor}
                    placeholder={"Escribe en markdown… **negrita**, ## título, [[Otra nota]], [enlace](url)\n\nCtrl+B negrita · Ctrl+I cursiva · Ctrl+K enlace · Ctrl+E vista previa"}
                    spellCheck={false}
                  />
                )}

                <div className="notas-panel-extra">
                  <label className="notas-campo-carpeta">
                    <Icon name="folder" size={14} /> Carpeta
                    <input type="text" value={carpeta} onChange={(e) => setCarpeta(e.target.value)} placeholder="Sin carpeta (usa / para subcarpetas)" />
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
