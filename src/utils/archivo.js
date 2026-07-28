const KB = 1024;
const MB = KB * 1024;

/** "1.4 MB", "820 KB". Cadena vacía si no hay dato, para no pintar "0 KB" bajo cada archivo. */
export const formatoPeso = (bytes) => {
  if (!bytes) return "";
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KB))} KB`;
};

/**
 * Etiqueta corta para la esquina de la tarjeta de archivo: "PDF", "DOCX", "XLSX".
 *
 * Sale de la extensión y no del mime a propósito: "PDF" dice más de un vistazo que
 * "application/pdf", y el mime de un .docx es tan largo que no cabe en ningún sitio.
 * Si no hay extensión utilizable, se cae al mime como último recurso.
 */
export const etiquetaTipo = (nombre, mime) => {
  const ext = (nombre || "").split(".").pop();
  if (ext && ext.length <= 4 && ext !== nombre) return ext.toUpperCase();
  return (mime || "").split("/").pop().slice(0, 4).toUpperCase() || "ARCH";
};
