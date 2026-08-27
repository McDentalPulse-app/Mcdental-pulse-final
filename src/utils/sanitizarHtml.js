import DOMPurify from "dompurify";

// Compartido por HtmlSeguro.jsx (avisos) y NotasPanel.jsx (notas) — ambos guardan HTML de
// TipTap y necesitan el mismo saneo anti-XSS antes de mostrarlo. Un único punto: cambiar
// la lista blanca aquí la cambia para los dos.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

const CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "h2", "h3", "blockquote", "span"],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

export const sanitizarHtml = (html) => DOMPurify.sanitize(html || "", CONFIG);
