import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { notify } from "../../utils/notify";
import Icon from "../ui/Icon";

// Botón del toolbar. A nivel de módulo (no dentro del render) para no recrearlo en cada pintado.
// onMouseDown + preventDefault mantiene el foco en el editor al pulsar.
function Btn({ accion, activo, icono, titulo }) {
  return (
    <button type="button" title={titulo} aria-label={titulo}
      className={`editor-btn${activo ? " editor-btn--activo" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); accion(); }}>
      <Icon name={icono} size={16} />
    </button>
  );
}

/**
 * Editor de texto enriquecido (TipTap) para dar formato a los avisos: negrita, cursiva, subrayado,
 * títulos, listas y enlaces. Guarda HTML — que se muestra sanitizado con <HtmlSeguro>.
 *
 * props: value (HTML), onChange(html).
 */
export default function EditorTexto({ value = "", onChange, placeholder = "Escribe el aviso…" }) {
  // Último HTML conocido (lo que emitimos o pusimos). Comparar contra este ref evita llamar
  // editor.getHTML() en el efecto — que crasheaba al reconectarse (Suspense/StrictMode) con el
  // editor a medio destruir ("Cannot read properties of null (reading 'cached')").
  const ultimoRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value,
    immediatelyRender: false, // evita el doble-render de StrictMode que dejaba el esquema en null
    onUpdate: ({ editor }) => {
      if (editor.isDestroyed) return;
      const html = editor.isEmpty ? "" : editor.getHTML();
      ultimoRef.current = html;
      onChange?.(html);
    },
    editorProps: { attributes: { class: "editor-area", "data-placeholder": placeholder } },
  });

  // Sincroniza cuando el valor cambia DESDE FUERA (cargar un aviso para editar, o limpiar tras
  // guardar). Compara contra el ref (no contra getHTML) y solo actúa si el editor está vivo.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value !== ultimoRef.current) {
      ultimoRef.current = value;
      if (!editor.isFocused) editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  if (!editor) return <div className="editor-cargando">Cargando editor…</div>;

  const ponerEnlace = () => {
    const previo = editor.getAttributes("link").href || "";
    notify.prompt({
      title: "Enlace",
      description: "Pega la URL (deja vacío para quitar el enlace):",
      placeholder: "https://…",
      confirmText: "Aplicar",
    }).then((url) => {
      if (url === null) return;
      if (!url.trim()) { editor.chain().focus().unsetLink().run(); return; }
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    });
    void previo;
  };

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <Btn titulo="Negrita" icono="bold" activo={editor.isActive("bold")} accion={() => editor.chain().focus().toggleBold().run()} />
        <Btn titulo="Cursiva" icono="italic" activo={editor.isActive("italic")} accion={() => editor.chain().focus().toggleItalic().run()} />
        <Btn titulo="Subrayado" icono="underline" activo={editor.isActive("underline")} accion={() => editor.chain().focus().toggleUnderline().run()} />
        <Btn titulo="Tachado" icono="strike" activo={editor.isActive("strike")} accion={() => editor.chain().focus().toggleStrike().run()} />
        <span className="editor-sep" />
        <Btn titulo="Título" icono="h2" activo={editor.isActive("heading", { level: 2 })} accion={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Btn titulo="Subtítulo" icono="h3" activo={editor.isActive("heading", { level: 3 })} accion={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="editor-sep" />
        <Btn titulo="Lista con viñetas" icono="listBullet" activo={editor.isActive("bulletList")} accion={() => editor.chain().focus().toggleBulletList().run()} />
        <Btn titulo="Lista numerada" icono="listOrdered" activo={editor.isActive("orderedList")} accion={() => editor.chain().focus().toggleOrderedList().run()} />
        <span className="editor-sep" />
        <Btn titulo="Enlace" icono="link" activo={editor.isActive("link")} accion={ponerEnlace} />
        <Btn titulo="Quitar formato" icono="clearFormat" accion={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
