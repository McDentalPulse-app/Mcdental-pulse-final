const KB = 1024;
const MB = KB * 1024;

/**
 * Nombre apto para una RUTA de storage. El nombre bonito se guarda aparte y es el que se
 * muestra y se descarga.
 *
 * Esto no es cosmética: al migrar el storage el 2026-07-27, un expediente llamado
 * "Actividades Erick Torres 29_04 Junio_Julio.pdf" reventó la subida porque el espacio no
 * puede ir en una URL sin escapar. Aquí el problema se corta de raíz.
 *
 * Vivía suelto dentro de mensajesService, así que el chat quedó a salvo y el expediente no:
 * el 2026-08-03 la primera subida real a un expediente falló por esto mismo, con la ruta
 * cortada por la mitad del nombre. Una defensa que solo protege a quien se acordó de
 * copiarla no es una defensa.
 */
export const rutaSegura = (nombre) =>
  (nombre || "archivo")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // fuera acentos (combinantes)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);                                        // conserva la extensión

/** Extensión → mime, solo para los tipos que los buckets aceptan. */
const MIME_POR_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * El mime con el que subir un archivo.
 *
 * Hay que MANDARLO explícitamente. Si no se manda, el cliente pone
 * `application/octet-stream` y los buckets —que declaran una lista blanca de tipos desde el
 * arreglo de seguridad del 2026-08-02— responden 415 «mime type application/octet-stream is
 * not supported». Es exactamente lo que tumbó la primera subida a un expediente.
 *
 * El navegador casi siempre trae el tipo en `File.type`, pero lo deja vacío cuando no
 * reconoce la extensión o cuando el archivo llega de ciertos gestores de archivos de Android.
 * Por eso hay respaldo por extensión antes de rendirse a octet-stream.
 */
export const mimeDeArchivo = (archivo) => {
  if (archivo?.type) return archivo.type;
  const ext = (archivo?.name || "").split(".").pop().toLowerCase();
  return MIME_POR_EXTENSION[ext] || "application/octet-stream";
};

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
