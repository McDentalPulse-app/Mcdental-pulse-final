import { useState } from "react";
import Icon from "../ui/Icon";
import Card from "../common/Card";
import { notify } from "../../utils/notify";
import {
  subirResponsabilidades,
  eliminarResponsabilidades,
  getSignedUrlResponsabilidades,
} from "../../services/supabase/responsabilidadesService";

/**
 * Tarjeta de un departamento: nombre, su archivo de "responsabilidades y actividades" (un PDF
 * o Word que sube admin/admin_plus/rh — mig. 153) y el botón de descarga para cualquiera.
 */
export default function ResponsabilidadesArea({ area, puedeEditar, usuarioId, onCambio }) {
  const [subiendo, setSubiendo] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const tieneArchivo = !!area.archivoRuta;

  const descargar = async () => {
    setDescargando(true);
    try {
      const url = await getSignedUrlResponsabilidades(area.archivoRuta);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify.toast.error(error.message || "No se pudo abrir el archivo.");
    } finally {
      setDescargando(false);
    }
  };

  const subir = async (archivo) => {
    if (!archivo) return;
    setSubiendo(true);
    try {
      await subirResponsabilidades({
        areaId: area.id,
        archivo,
        subidoPor: usuarioId,
        rutaVieja: area.archivoRuta,
      });
      notify.toast.success("Archivo de responsabilidades actualizado.");
      onCambio?.();
    } catch (error) {
      notify.toast.error(error.message || "No se pudo subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async () => {
    const ok = await notify.confirm({
      title: "Borrar archivo",
      description: `¿Borrar el archivo de responsabilidades de "${area.nombre}"?`,
      variant: "warning",
      confirmText: "Borrar",
    });
    if (!ok) return;
    try {
      await eliminarResponsabilidades({ areaId: area.id, ruta: area.archivoRuta });
      notify.toast.success("Archivo borrado.");
      onCambio?.();
    } catch (error) {
      notify.toast.error(error.message || "No se pudo borrar el archivo.");
    }
  };

  return (
    <Card className="organigrama-area-card">
      <div className="organigrama-area-nombre">{area.nombre}</div>
      {tieneArchivo ? (
        <div className="organigrama-area-archivo">
          <Icon name="file" size={16} />
          <span className="organigrama-area-archivo-nombre">{area.archivoNombre}</span>
        </div>
      ) : (
        <div className="organigrama-area-sin-archivo">Sin archivo de responsabilidades.</div>
      )}
      <div className="organigrama-area-acciones">
        {tieneArchivo && (
          <button type="button" className="mc-btn-secondary" onClick={descargar} disabled={descargando}>
            <Icon name="download" size={16} /> {descargando ? "Abriendo…" : "Descargar"}
          </button>
        )}
        {puedeEditar && (
          <>
            <label className="mc-btn-secondary organigrama-area-subir">
              <Icon name="upload" size={16} />
              {subiendo ? "Subiendo…" : tieneArchivo ? "Reemplazar" : "Subir"}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                hidden
                disabled={subiendo}
                onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }}
              />
            </label>
            {tieneArchivo && (
              <button type="button" className="mc-btn-secondary organigrama-area-borrar" onClick={eliminar} aria-label="Borrar archivo">
                <Icon name="trash" size={16} />
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
