import { useState, useEffect, useCallback } from "react";
import Icon from "../ui/Icon";
import Select from "../common/Select";
import ContratoLaboral from "./ContratoLaboral";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useNotification } from "../../contexts/NotificationContext";
import { TIPOS_CONTRATO, ETIQUETA_TIPO_CONTRATO, datosContratoIniciales } from "../../utils/contrato";
import { generarPdfContrato } from "../../utils/contratoPdf";
import { descargarArchivoExpediente } from "../../services/supabase/archivosExpedienteService";
import { extraerDatosDocumentos } from "../../services/extraccionDocumentosService";

// Los cuatro tipos de documento de identidad que el expediente ya sabe distinguir (ver el
// selector "Tipo de archivo" en ExpedienteIntegral.jsx) — de ahí es de donde se puede sacar
// algo para el contrato. "General"/"PDF" quedan fuera: podría ser cualquier cosa.
const TIPOS_DOC_IDENTIDAD = ["INE", "CURP", "RFC", "Comprobante"];
const MIME_SOPORTADOS_IA = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

const CampoTexto = ({ label, value, onChange, placeholder }) => (
  <div className="mc-form-group">
    <label className="mc-form-label">{label}</label>
    <input type="text" className="mc-form-input" value={value} onChange={onChange} placeholder={placeholder} />
  </div>
);

/**
 * Genera un contrato individual de trabajo A PARTIR de los documentos ya subidos a "Archivos
 * del expediente" (INE, CURP, RFC, comprobante de domicilio): en cuanto se abre el modal, se
 * leen esos documentos con IA y se prellena el contrato solo, sin que RH tenga que capturar
 * nada a mano primero. El botón "Extraer datos de los documentos" queda solo para RE-leerlos
 * (si se subió uno nuevo, o si la primera pasada no leyó bien algo) — no es el paso principal.
 *
 * Cada campo que la IA no pudo leer con certeza se queda vacío para completarse a mano, nunca
 * con un dato inventado (ver utils/contrato.js). Y lo que ya esté escrito no se pisa: la
 * extracción solo llena lo que sigue vacío.
 *
 * La vista previa de abajo (ContratoLaboral.jsx) es EL MISMO documento que se genera al
 * final, actualizado en vivo con cada cambio de arriba — no un formulario aparte que no se
 * parece al resultado.
 */
export default function GenerarContratoModal({ empleado, archivosEmpleado = [], onSubirArchivoExpediente, onCerrar }) {
  const { toast } = useNotification();
  const [datos, setDatos] = useState(() => datosContratoIniciales(empleado));
  const [extrayendo, setExtrayendo] = useState(false);
  const [generando, setGenerando] = useState(false);

  useEscapeKey(onCerrar, true);

  const set = (campoNombre) => (e) => setDatos((d) => ({ ...d, [campoNombre]: e.target.value }));

  const documentosDisponibles = archivosEmpleado.filter((a) => TIPOS_DOC_IDENTIDAD.includes(a.tipoArchivo));

  const extraerDeDocumentos = useCallback(async ({ silencioso = false } = {}) => {
    if (documentosDisponibles.length === 0) {
      if (!silencioso) toast.warning('Sube primero un INE, CURP, RFC o comprobante en "Archivos del expediente".');
      return;
    }
    setExtrayendo(true);
    try {
      const archivosParaIA = [];
      for (const doc of documentosDisponibles) {
        const blob = await descargarArchivoExpediente(doc.rutaArchivo);
        if (MIME_SOPORTADOS_IA.includes(blob.type)) archivosParaIA.push({ blob, mimeType: blob.type });
      }
      if (archivosParaIA.length === 0) {
        toast.warning("Los documentos subidos no son imágenes ni PDF que la IA pueda leer.");
        return;
      }

      const extraido = await extraerDatosDocumentos(archivosParaIA);
      // Solo se llena lo que la IA SÍ pudo leer (viene null si no); lo que ya estaba
      // capturado a mano no se pisa.
      setDatos((d) => ({
        ...d,
        nombreTrabajador: d.nombreTrabajador || extraido.nombreCompleto || "",
        curp: d.curp || extraido.curp || "",
        rfc: d.rfc || extraido.rfc || "",
        fechaNacimiento: d.fechaNacimiento || extraido.fechaNacimiento || "",
        sexo: d.sexo || extraido.sexo || "",
        estadoCivil: d.estadoCivil || extraido.estadoCivil || "",
        nacionalidad: d.nacionalidad || extraido.nacionalidad || "",
        domicilioCalleNumero: d.domicilioCalleNumero || extraido.domicilioCalleNumero || "",
        domicilioColonia: d.domicilioColonia || extraido.domicilioColonia || "",
        domicilioCP: d.domicilioCP || extraido.domicilioCP || "",
        domicilioCiudad: d.domicilioCiudad || extraido.domicilioCiudad || "",
        domicilioEstado: d.domicilioEstado || extraido.domicilioEstado || "",
      }));
      toast.success("Datos extraídos. Revísalos abajo antes de generar el contrato.");
    } catch (error) {
      toast.error(error?.message || "No se pudieron extraer los datos de los documentos.");
    } finally {
      setExtrayendo(false);
    }
  }, [documentosDisponibles, toast]);

  // Automático al abrir: el contrato se arma A PARTIR de los documentos, no rellenando un
  // formulario a mano — la extracción manual (el botón de abajo) queda solo para reintentar
  // si algo cambió (se subió un documento nuevo) o la primera pasada no leyó bien algo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el setState real vive dentro de extraerDeDocumentos, en la respuesta async de la IA, no en el cuerpo síncrono de este efecto.
    extraerDeDocumentos({ silencioso: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo una vez al abrir el modal para este empleado, no cada vez que `extraerDeDocumentos` se recalcula.
  }, [empleado.id]);

  const generar = async () => {
    setGenerando(true);
    try {
      const blobPdf = generarPdfContrato(datos);
      const archivo = new File([blobPdf], `Contrato - ${empleado.name}.pdf`, { type: "application/pdf" });
      await onSubirArchivoExpediente({ empleado, archivo, tipo: "Contrato" });
      window.open(URL.createObjectURL(blobPdf), "_blank", "noopener,noreferrer");
      onCerrar();
    } catch (error) {
      toast.error(error?.message || "No se pudo generar el contrato.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="mc-modal-overlay" onClick={onCerrar} role="presentation">
      <div
        className="mc-modal contrato-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contrato-modal-titulo"
      >
        <h2 id="contrato-modal-titulo" className="mc-modal-title mc-btn-with-icon">
          <Icon name="file" size={20} /> Generar contrato — {empleado.name}
        </h2>

        <div className="contrato-controles">
          <div className="mc-form-group">
            <label className="mc-form-label">Tipo de contrato</label>
            <Select value={datos.tipoContrato} onChange={(v) => setDatos((d) => ({ ...d, tipoContrato: v }))}>
              {Object.entries(ETIQUETA_TIPO_CONTRATO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </Select>
          </div>

          {datos.tipoContrato === TIPOS_CONTRATO.DETERMINADO && (
            <div className="mc-form-group">
              <label className="mc-form-label">Fecha de término</label>
              <input type="date" className="mc-form-input" value={datos.fechaTermino} onChange={set("fechaTermino")} />
            </div>
          )}
          {datos.tipoContrato === TIPOS_CONTRATO.OBRA && (
            <CampoTexto
              label="Descripción de la obra"
              value={datos.descripcionObra}
              onChange={set("descripcionObra")}
              placeholder="Ej. Remodelación del consultorio 3"
            />
          )}

          {documentosDisponibles.length === 0 ? (
            <p className="mc-hint">
              <Icon name="alert" size={14} />
              Aún no hay INE, CURP, RFC ni comprobante subidos en "Archivos del expediente" de esta persona —
              súbelos ahí y vuelve a abrir este contrato.
            </p>
          ) : (
            <>
              <p className="mc-hint">
                <Icon name="sparkles" size={14} />
                {extrayendo
                  ? `Leyendo ${documentosDisponibles.length} documento${documentosDisponibles.length === 1 ? "" : "s"} del expediente...`
                  : "El contrato de abajo se armó con lo que la IA pudo leer de sus documentos."}
              </p>
              <button
                type="button"
                className="mc-btn-outline mc-btn-with-icon contrato-extraer-btn"
                disabled={extrayendo}
                onClick={() => extraerDeDocumentos()}
              >
                <Icon name="sparkles" size={16} />
                {extrayendo ? "Leyendo documentos..." : "Volver a leer los documentos"}
              </button>
            </>
          )}

          <div className="contrato-grid-campos">
            <CampoTexto label="Razón social del patrón" value={datos.razonSocialPatron} onChange={set("razonSocialPatron")} />
            <CampoTexto label="Domicilio del patrón" value={datos.domicilioPatron} onChange={set("domicilioPatron")} placeholder="Calle, número, colonia, ciudad, estado" />
            <CampoTexto label="Representante del patrón" value={datos.representantePatron} onChange={set("representantePatron")} />
            <CampoTexto label="Nombre del trabajador" value={datos.nombreTrabajador} onChange={set("nombreTrabajador")} />
            <CampoTexto label="CURP" value={datos.curp} onChange={set("curp")} />
            <CampoTexto label="RFC" value={datos.rfc} onChange={set("rfc")} />
            <div className="mc-form-group">
              <label className="mc-form-label">Fecha de nacimiento</label>
              <input type="date" className="mc-form-input" value={datos.fechaNacimiento} onChange={set("fechaNacimiento")} />
            </div>
            <div className="mc-form-group">
              <label className="mc-form-label">Sexo</label>
              <Select value={datos.sexo} onChange={(v) => setDatos((d) => ({ ...d, sexo: v }))}>
                <option value="">Sin especificar</option>
                <option value="Hombre">Hombre</option>
                <option value="Mujer">Mujer</option>
              </Select>
            </div>
            <CampoTexto label="Estado civil" value={datos.estadoCivil} onChange={set("estadoCivil")} />
            <CampoTexto label="Nacionalidad" value={datos.nacionalidad} onChange={set("nacionalidad")} />
            <CampoTexto label="Domicilio (calle y número)" value={datos.domicilioCalleNumero} onChange={set("domicilioCalleNumero")} />
            <CampoTexto label="Colonia" value={datos.domicilioColonia} onChange={set("domicilioColonia")} />
            <CampoTexto label="Código postal" value={datos.domicilioCP} onChange={set("domicilioCP")} />
            <CampoTexto label="Ciudad" value={datos.domicilioCiudad} onChange={set("domicilioCiudad")} />
            <CampoTexto label="Estado" value={datos.domicilioEstado} onChange={set("domicilioEstado")} />
          </div>
        </div>

        <div className="contrato-preview-wrap">
          <ContratoLaboral datos={datos} />
        </div>

        <div className="mc-form-actions">
          <button type="button" className="mc-btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="mc-btn-primary mc-btn-with-icon" disabled={generando} onClick={generar}>
            <Icon name="file" size={16} /> {generando ? "Generando..." : "Generar contrato"}
          </button>
        </div>
      </div>
    </div>
  );
}
