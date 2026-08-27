import { sanitizarHtml } from "../../utils/sanitizarHtml";

// Los avisos guardan HTML (editor de texto enriquecido). Renderizarlo requiere sanitizar SIEMPRE
// (anti-XSS): DOMPurify quita <script>, on* handlers, iframes, etc. y deja solo formato seguro.
const HtmlSeguro = ({ html, className }) => (
  <div className={className} dangerouslySetInnerHTML={{ __html: sanitizarHtml(html) }} />
);

export default HtmlSeguro;
