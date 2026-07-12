import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const BUCKET = "expedientes";
const MAX_BYTES = 10 * 1024 * 1024;

const mapArchivo = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  nombreArchivo: row.nombre_archivo,
  tipoArchivo: row.tipo_archivo,
  rutaArchivo: row.ruta_archivo,
  fecha: row.fecha,
  subidoPor: row.subido_por,
});

export const getArchivosExpediente = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("archivos_expediente").select("*"));
    return rows.map(mapArchivo);
  } catch (error) {
    console.error("Error al obtener archivos de expediente:", error);
    throw new Error("No se pudieron cargar los archivos del expediente.", { cause: error });
  }
};

// Sube el archivo al bucket privado y registra su metadata. Lanza si excede MAX_BYTES.
export const subirArchivoExpediente = async ({ empleadoId, archivo, tipo, subidoPor }) => {
  if (archivo.size > MAX_BYTES) {
    throw new Error("El archivo excede el límite de 10 MB permitido.");
  }

  const rutaArchivo = `${empleadoId}/${Date.now()}-${archivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(rutaArchivo, archivo);
  if (uploadError) {
    console.error("Error subiendo archivo a Storage:", uploadError);
    throw new Error("No se pudo subir el archivo.");
  }

  const { data, error } = await supabase
    .from("archivos_expediente")
    .insert({
      empleado_id: empleadoId,
      nombre_archivo: archivo.name,
      tipo_archivo: tipo || "General",
      ruta_archivo: rutaArchivo,
      subido_por: subidoPor,
    })
    .select()
    .single();

  if (error) {
    console.error("Error registrando archivo de expediente:", error);
    throw new Error("No se pudo guardar la referencia del archivo.");
  }
  return mapArchivo(data);
};

// El bucket es privado: no hay URL pública persistida, se genera on-demand.
export const getSignedUrlArchivoExpediente = async (rutaArchivo, expiresInSeconds = 300) => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(rutaArchivo, expiresInSeconds);
  if (error) {
    console.error("Error generando signed URL:", error);
    throw new Error("No se pudo generar el enlace del archivo.");
  }
  return data.signedUrl;
};
