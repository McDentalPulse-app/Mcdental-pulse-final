import DOMPurify from "dompurify";

// Compartido por HtmlSeguro.jsx (avisos) y NotasPanel.jsx (notas) — ambos necesitan el
// mismo saneo anti-XSS antes de mostrar HTML. Un único punto: cambiar el hook aquí lo
// cambia para los dos.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

// Avisos: HTML de TipTap (editor con toolbar limitado), lista blanca angosta a propósito.
const CONFIG_AVISO = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "h2", "h3", "blockquote", "span"],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

export const sanitizarHtml = (html) => DOMPurify.sanitize(html || "", CONFIG_AVISO);

// Notas: HTML generado por `marked` a partir del markdown que escribe el propio dueño de
// la nota — lista más ancha porque markdown de verdad cubre encabezados h1-h6, código
// (en línea y en bloque), cita, regla horizontal y tachado. Sigue sin admitir <img>,
// <iframe> ni <script>: aunque la nota es privada, sanear no cuesta nada y evita que un
// pegado descuidado (HTML copiado de otro lado) cuele algo raro.
const CONFIG_NOTA = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "del",
    "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "span", "code", "pre", "hr",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

export const sanitizarHtmlNota = (html) => DOMPurify.sanitize(html || "", CONFIG_NOTA);
