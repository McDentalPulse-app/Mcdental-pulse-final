import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../ui/Icon";
import { formatoPeso, etiquetaTipo, descargarBlob } from "../../utils/archivo";

/**
 * Visor de documentos DENTRO de la app: PDF, Word (.docx), Excel (.xlsx / .csv), imágenes y
 * texto. Pedido del dueño (2026-09-30): ver los adjuntos de las Notas sin descargarlos.
 *
 * Se dibuja todo en el cliente, a partir del archivo entero (`cargar()` devuelve un Blob):
 *   · PDF con pdf.js y no con un <iframe>. El visor nativo del navegador no sirve en el
 *     teléfono: Safari en iPhone enseña solo la primera página y Chrome en Android no enseña
 *     nada, descarga. pdf.js pinta cada página en un <canvas> igual en todos lados.
 *   · Word con docx-preview (convierte el .docx en HTML con su formato).
 *   · Excel con exceljs, que la app ya usaba para exportar. Una pestaña por hoja.
 * Las tres librerías se cargan con import() solo al abrir un archivo de su tipo: no pesan en
 * la carga normal de la app.
 *
 * Los formatos viejos (.doc, .xls) no se pueden dibujar en el navegador: se ofrece descargarlos.
 *
 * Va en un portal a document.body (DESIGN.md → "todo lo que flota va en un portal").
 */

const EXT_A_TIPO = { pdf: "pdf", docx: "docx", doc: "doc", xlsx: "xlsx", xls: "xls", csv: "csv", txt: "txt" };

const tipoDe = (nombre = "", mime = "") => {
  if (mime.startsWith("image/")) return "imagen";
  const ext = nombre.split(".").pop().toLowerCase();
  if (EXT_A_TIPO[ext]) return EXT_A_TIPO[ext];
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("spreadsheetml")) return "xlsx";
  if (mime === "text/csv") return "csv";
  if (mime.startsWith("text/")) return "txt";
  return "otro";
};

// Tope de lo que se pinta de una hoja de Excel: una tabla de 50 000 filas congela el teléfono.
// El archivo completo sigue a un clic en "Descargar".
const MAX_FILAS = 1000;
const MAX_COLUMNAS = 50;

const letraColumna = (n) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

/**
 * Texto de una celda de Excel con SU formato. `cell.text` de exceljs no aplica el formato de
 * número: una fecha salía como "Sun Feb 02 2020 00:00:00 GMT-0600…" y una moneda como "2037.5".
 * Aquí se cubren los formatos que de verdad se usan (fecha, hora, moneda, %, decimales, miles);
 * cualquier otro cae al texto crudo.
 */
// `instanceof Date` falla con las fechas de exceljs (medido: salían como texto crudo); se mira
// el tipo real del objeto.
const esFecha = (v) => Object.prototype.toString.call(v) === "[object Date]" && !Number.isNaN(v.getTime());

const formatearCelda = (celda) => {
  let v = celda.value;
  if (v && typeof v === "object" && !esFecha(v)) {
    if ("result" in v) v = v.result;                                  // fórmula → su resultado
    else if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    else if ("text" in v) return String(v.text ?? "");                // hipervínculo
    else if ("error" in v) return String(v.error);
  }
  if (v === null || v === undefined) return "";
  const fmt = String(celda.numFmt || "");
  if (esFecha(v)) {
    // exceljs entrega las fechas en UTC: formatearlas en otra zona las correría un día.
    const fecha = v.toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
    return /h/i.test(fmt) ? `${fecha} ${v.toLocaleTimeString("es-MX", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })}` : fecha;
  }
  if (typeof v === "number") {
    const decimales = fmt.match(/\.(0+)/)?.[1].length ?? 0;
    if (fmt.includes("%")) return new Intl.NumberFormat("es-MX", { style: "percent", minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
    if (fmt.includes("$")) return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
    if (/#,##0|0\.0/.test(fmt)) return new Intl.NumberFormat("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: fmt.includes(",") }).format(v);
    return String(v);
  }
  return celda.text ?? String(v);
};

/** CSV simple con comillas dobles ("a, b" y "" para una comilla). Detecta ; o , como separador. */
const parsearCsv = (texto) => {
  const primera = texto.split(/\r?\n/, 1)[0] || "";
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ";" : ",";
  const filas = [];
  let fila = [], celda = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
};

export default function VisorArchivo({ archivo, cargar, onCerrar }) {
  const tipo = tipoDe(archivo?.nombre, archivo?.mime);
  const [blob, setBlob] = useState(null);
  const [estado, setEstado] = useState("cargando"); // cargando · listo · error · sin-vista
  const [mensajeError, setMensajeError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [paginas, setPaginas] = useState(0);
  const [hojas, setHojas] = useState([]);           // Excel/CSV: [{ nombre, filas, recortada }]
  const [hojaActiva, setHojaActiva] = useState(0);
  const [texto, setTexto] = useState("");
  const [urlImagen, setUrlImagen] = useState(null);
  const lienzoRef = useRef(null);   // donde se pintan PDF y Word
  const cuerpoRef = useRef(null);

  // Esc cierra, y el fondo no se desplaza mientras el visor está abierto.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", onKey);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflowPrevio; };
  }, [onCerrar]);

  // 1. Traer el archivo.
  useEffect(() => {
    let vivo = true;
    cargar()
      .then((b) => { if (vivo) setBlob(b); })
      .catch((e) => { if (vivo) { setMensajeError(e?.message || "No se pudo abrir el archivo."); setEstado("error"); } });
    return () => { vivo = false; };
  }, [cargar]);

  // 2. Preparar lo que no depende del ancho (Excel, CSV, texto, imagen).
  useEffect(() => {
    if (!blob) return undefined;
    let vivo = true;
    let url;
    (async () => {
      try {
        if (tipo === "imagen") {
          url = URL.createObjectURL(blob);
          setUrlImagen(url);
          setEstado("listo");
        } else if (tipo === "txt") {
          setTexto(await blob.text());
          setEstado("listo");
        } else if (tipo === "csv") {
          const filas = parsearCsv(await blob.text());
          if (!vivo) return;
          setHojas([{ nombre: archivo.nombre, filas: filas.slice(0, MAX_FILAS).map((f) => f.slice(0, MAX_COLUMNAS)), recortada: filas.length > MAX_FILAS }]);
          setEstado("listo");
        } else if (tipo === "xlsx") {
          const ExcelJS = (await import("exceljs")).default;
          const libro = new ExcelJS.Workbook();
          await libro.xlsx.load(await blob.arrayBuffer());
          if (!vivo) return;
          setHojas(libro.worksheets.map((hoja) => {
            const filas = [];
            const ultimaCol = Math.min(hoja.columnCount || 0, MAX_COLUMNAS);
            const ultimaFila = Math.min(hoja.rowCount || 0, MAX_FILAS);
            for (let r = 1; r <= ultimaFila; r++) {
              const fila = hoja.getRow(r);
              const celdas = [];
              for (let c = 1; c <= ultimaCol; c++) celdas.push(formatearCelda(fila.getCell(c)));
              filas.push(celdas);
            }
            return { nombre: hoja.name, filas, recortada: (hoja.rowCount || 0) > MAX_FILAS || (hoja.columnCount || 0) > MAX_COLUMNAS };
          }));
          setEstado("listo");
        } else if (tipo === "doc" || tipo === "xls" || tipo === "otro") {
          setEstado("sin-vista");
        }
      } catch (e) {
        console.error("Visor:", e);
        if (vivo) { setMensajeError("No se pudo leer el archivo. Puede estar dañado o protegido con contraseña."); setEstado("error"); }
      }
    })();
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [blob, tipo, archivo?.nombre]);

  // 3. PDF: se pinta página por página al ancho disponible (× zoom). Se vuelve a pintar al
  //    cambiar el zoom. Con `cancelado` una pintura vieja no se mezcla con la nueva.
  useEffect(() => {
    if (!blob || tipo !== "pdf" || !lienzoRef.current) return undefined;
    let cancelado = false;
    let tarea;   // la tarea de carga de pdf.js: es lo que se destruye al cerrar (libera el worker)
    const lienzo = lienzoRef.current;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        tarea = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
        const documento = await tarea.promise;
        if (cancelado) return;
        setPaginas(documento.numPages);
        lienzo.replaceChildren();
        const ancho = Math.max(280, (cuerpoRef.current?.clientWidth || 800) - 32);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= documento.numPages; n++) {
          if (cancelado) return;
          const pagina = await documento.getPage(n);
          const base = pagina.getViewport({ scale: 1 });
          const escala = Math.min(ancho / base.width, 1.6) * zoom;
          const vista = pagina.getViewport({ scale: escala });
          const canvas = document.createElement("canvas");
          canvas.className = "visor-pdf-pagina";
          canvas.width = Math.floor(vista.width * dpr);
          canvas.height = Math.floor(vista.height * dpr);
          canvas.style.width = `${Math.floor(vista.width)}px`;
          canvas.style.height = `${Math.floor(vista.height)}px`;
          canvas.setAttribute("aria-label", `Página ${n} de ${documento.numPages}`);
          lienzo.appendChild(canvas);
          await pagina.render({ canvas, viewport: vista, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise;
          if (n === 1 && !cancelado) setEstado("listo");
        }
      } catch (e) {
        console.error("Visor PDF:", e);
        if (!cancelado) {
          setMensajeError(e?.name === "PasswordException" ? "El PDF está protegido con contraseña." : "No se pudo leer el PDF.");
          setEstado("error");
        }
      }
    })();
    // En pdf.js 6 el documento ya no tiene destroy(): se destruye la tarea de carga. Nunca debe
    // lanzar: un error en esta limpieza lo atraparía el ErrorBoundary y la pantalla entera se
    // volvería a montar (así se perdía la nota abierta al cerrar el visor).
    return () => {
      cancelado = true;
      try { tarea?.destroy?.()?.catch?.(() => {}); } catch { /* nada que liberar */ }
    };
  }, [blob, tipo, zoom]);

  // 4. Word: docx-preview arma las páginas como HTML. En pantallas angostas se reduce con
  //    `zoom` CSS para que la hoja (≈816 px de ancho) quepa sin desplazamiento lateral.
  useEffect(() => {
    if (!blob || tipo !== "docx" || !lienzoRef.current) return undefined;
    let cancelado = false;
    const lienzo = lienzoRef.current;
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        lienzo.replaceChildren();
        await renderAsync(blob, lienzo, undefined, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, experimental: false });
        if (cancelado) return;
        const hoja = lienzo.querySelector("section.docx");
        const disponible = (cuerpoRef.current?.clientWidth || 800) - 24;
        const anchoHoja = hoja?.offsetWidth || 816;
        lienzo.style.zoom = String(Math.min(1, disponible / anchoHoja) * zoom);
        setEstado("listo");
      } catch (e) {
        console.error("Visor Word:", e);
        if (!cancelado) { setMensajeError("No se pudo leer el documento de Word."); setEstado("error"); }
      }
    })();
    return () => { cancelado = true; };
  }, [blob, tipo, zoom]);

  const descargar = () => blob && descargarBlob(blob, archivo.nombre);
  const conZoom = tipo === "pdf" || tipo === "docx";
  const hoja = hojas[hojaActiva];
  // Columnas = las de la fila más larga: en un CSV no todas las filas miden lo mismo.
  const columnas = hoja ? Array.from({ length: Math.max(0, ...hoja.filas.map((f) => f.length)) }, (_, i) => i) : [];

  return createPortal(
    <div className="visor-archivo" role="dialog" aria-modal="true" aria-label={`Vista previa de ${archivo.nombre}`}>
      <header className="visor-barra">
        <span className="visor-tipo">{etiquetaTipo(archivo.nombre, archivo.mime)}</span>
        <div className="visor-titulo">
          <span className="visor-nombre" title={archivo.nombre}>{archivo.nombre}</span>
          <span className="visor-meta">
            {formatoPeso(archivo.bytes)}
            {tipo === "pdf" && paginas > 0 && ` · ${paginas} ${paginas === 1 ? "página" : "páginas"}`}
          </span>
        </div>
        <div className="visor-acciones">
          {conZoom && estado === "listo" && (
            <div className="visor-zoom" role="group" aria-label="Zoom">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Alejar" disabled={zoom <= 0.5}><Icon name="minus" size={16} /></button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Acercar" disabled={zoom >= 3}><Icon name="plus" size={16} /></button>
            </div>
          )}
          <button type="button" className="visor-btn" onClick={descargar} disabled={!blob} title="Descargar">
            <Icon name="download" size={17} /><span className="visor-btn-texto">Descargar</span>
          </button>
          <button type="button" className="visor-btn visor-btn--cerrar" onClick={onCerrar} aria-label="Cerrar" title="Cerrar (Esc)">
            <Icon name="close" size={19} />
          </button>
        </div>
      </header>

      {hojas.length > 1 && (
        <nav className="visor-hojas" aria-label="Hojas">
          {hojas.map((h, i) => (
            <button key={h.nombre + i} type="button" className={`visor-hoja${i === hojaActiva ? " visor-hoja--activa" : ""}`} onClick={() => setHojaActiva(i)}>
              {h.nombre}
            </button>
          ))}
        </nav>
      )}

      <div className="visor-cuerpo" ref={cuerpoRef}>
        {estado === "cargando" && (
          <div className="visor-estado"><span className="visor-spinner" aria-hidden="true" /> Abriendo {archivo.nombre}…</div>
        )}
        {estado === "error" && (
          <div className="visor-estado">
            <Icon name="alert" size={28} />
            <p>{mensajeError}</p>
            {blob && <button type="button" className="mc-btn-primary" onClick={descargar}><Icon name="download" size={16} /> Descargar</button>}
          </div>
        )}
        {estado === "sin-vista" && (
          <div className="visor-estado">
            <Icon name="file" size={32} />
            <p>
              {tipo === "doc" ? "Los documentos de Word antiguos (.doc) " : tipo === "xls" ? "Los libros de Excel antiguos (.xls) " : "Este tipo de archivo "}
              no se pueden ver dentro de la app. Descárgalo para abrirlo.
              {(tipo === "doc" || tipo === "xls") && " Si lo guardas como ." + (tipo === "doc" ? "docx" : "xlsx") + " sí se verá aquí."}
            </p>
            <button type="button" className="mc-btn-primary" onClick={descargar} disabled={!blob}><Icon name="download" size={16} /> Descargar</button>
          </div>
        )}

        {/* PDF y Word se pintan aquí a mano (canvas / HTML de docx-preview). */}
        {(tipo === "pdf" || tipo === "docx") && estado !== "error" && (
          <div ref={lienzoRef} className={`visor-lienzo visor-lienzo--${tipo}`} />
        )}

        {tipo === "imagen" && urlImagen && estado === "listo" && (
          <div className="visor-imagen">
            <img src={urlImagen} alt={archivo.nombre} onError={() => { setEstado("sin-vista"); }} style={{ transform: `scale(${zoom})` }} />
          </div>
        )}

        {tipo === "txt" && estado === "listo" && <pre className="visor-texto">{texto}</pre>}

        {(tipo === "xlsx" || tipo === "csv") && estado === "listo" && hoja && (
          <div className="visor-tabla-wrap">
            {hoja.filas.length === 0 ? (
              <p className="visor-estado">Esta hoja está vacía.</p>
            ) : (
              <table className="visor-tabla">
                <thead>
                  <tr>
                    <th className="visor-tabla-esquina" />
                    {columnas.map((c) => <th key={c}>{letraColumna(c + 1)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {hoja.filas.map((fila, r) => (
                    <tr key={r}>
                      <th>{r + 1}</th>
                      {columnas.map((c) => <td key={c}>{fila[c] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {hoja.recortada && (
              <p className="visor-aviso-recorte">
                Se muestran las primeras {MAX_FILAS} filas y {MAX_COLUMNAS} columnas. Descarga el archivo para verlo completo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
