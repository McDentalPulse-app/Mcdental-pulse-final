import DOMPurify from "dompurify";

// Los avisos guardan HTML (editor de texto enriquecido). Renderizarlo requiere sanitizar SIEMPRE
// (anti-XSS): DOMPurify quita <script>, on* handlers, iframes, etc. y deja solo formato seguro.
// Los enlaces se fuerzan a abrir en pestaña nueva con rel seguro.
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

const HtmlSeguro = ({ html, className }) => (
  <div className={className} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html || "", CONFIG) }} />
);

export default HtmlSeguro;
