import { useCallback, useState } from "react";
import Icon from "../ui/Icon";
import VisorArchivo from "../common/VisorArchivo";
import { formatoPeso, etiquetaTipo } from "../../utils/archivo";
import { descargarAdjuntoAviso } from "../../services/supabase/avisosService";

/** Color de la tarjeta según el tipo: rojo PDF, azul Word, verde Excel, morado imagen. */
const familia = (nombre = "", mime = "") => {
  const ext = nombre.split(".").pop().toLowerCase();
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  if (mime.startsWith("image/")) return "imagen";
  return "otro";
};

/**
 * Tarjetas de los archivos de un aviso (mig. 184). Al pulsar una se abre en el visor de la app,
 * sin descargarla. Con `onQuitar` (el formulario de gestión) cada tarjeta lleva su botón de quitar.
 */
export default function AdjuntosAviso({ adjuntos = [], onQuitar }) {
  const [abierto, setAbierto] = useState(null);
  const cargar = useCallback(() => descargarAdjuntoAviso(abierto.ruta), [abierto]);
  if (!adjuntos.length) return null;

  return (
    <div className="adjuntos-lista">
      {adjuntos.map((a) => (
        <div key={a.ruta} className={`adjunto-card adjunto-card--${familia(a.nombre, a.mime)}`}>
          <button type="button" className="adjunto-card-abrir" onClick={() => setAbierto(a)} title={`Ver ${a.nombre}`}>
            <span className="adjunto-card-tipo">{etiquetaTipo(a.nombre, a.mime)}</span>
            <span className="adjunto-card-info">
              <span className="adjunto-card-nombre">{a.nombre}</span>
              <span className="adjunto-card-peso">{formatoPeso(a.bytes)}</span>
            </span>
          </button>
          {onQuitar && (
            <button type="button" className="adjunto-card-quitar" onClick={() => onQuitar(a)} aria-label={`Quitar ${a.nombre}`} title="Quitar">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      ))}
      {abierto && <VisorArchivo archivo={abierto} cargar={cargar} onCerrar={() => setAbierto(null)} />}
    </div>
  );
}
