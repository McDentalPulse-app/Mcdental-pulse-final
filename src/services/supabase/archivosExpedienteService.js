import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";
import { rutaSegura, mimeDeArchivo } from "../../utils/archivo";

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

/**
 * Traduce el fallo del almacén a algo que la persona pueda accionar.
 *
 * El bucket declara una lista blanca de tipos, así que el rechazo más probable no es un
 * problema de permisos ni de red: es que ese archivo no está permitido. Decirlo por su nombre
 * evita que alguien reintente diez veces lo mismo creyendo que falla la conexión.
 */
const mensajeDeSubida = (error, archivo) => {
  const texto = `${error?.message || ""} ${error?.error || ""}`.toLowerCase();
  if (texto.includes("mime")) {
    const ext = (archivo?.name || "").split(".").pop().toLowerCase();
    return `El expediente no acepta archivos ${ext ? `.${ext}` : "de este tipo"}. Se admiten PDF, Word, Excel, texto e imágenes.`;
  }
  if (texto.includes("exceeded") || texto.includes("too large") || texto.includes("payload")) {
    return "El archivo excede el límite de 10 MB permitido.";
  }
  if (texto.includes("row-level security") || texto.includes("unauthorized")) {
    return "Tu cuenta no tiene permiso para subir archivos al expediente.";
  }
  return `No se pudo subir el archivo. ${error?.message || ""}`.trim();
};

// Sube el archivo al bucket privado y registra su metadata. Lanza si excede MAX_BYTES.
export const subirArchivoExpediente = async ({ empleadoId, archivo, tipo, subidoPor }) => {
  if (archivo.size > MAX_BYTES) {
    throw new Error("El archivo excede el límite de 10 MB permitido.");
  }

  // El nombre va SANEADO en la ruta y el bonito se guarda aparte, en `nombre_archivo`.
  // Sin esto, un nombre con espacios o acentos corta la URL de subida por la mitad.
  const rutaArchivo = `${empleadoId}/${Date.now()}-${rutaSegura(archivo.name)}`;

  // Y el mime va EXPLÍCITO. Sin él el cliente manda `application/octet-stream`, que no está
  // en la lista blanca del bucket, y el almacén contesta 415.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(rutaArchivo, archivo, { upsert: false, contentType: mimeDeArchivo(archivo) });

  if (uploadError) {
    console.error("Error subiendo archivo a Storage:", uploadError);
    // El motivo REAL, no "no se pudo". Decir solo "no se pudo subir el archivo" es lo que
    // hizo falta mirar los registros del servidor para averiguar que era el tipo de archivo.
    throw new Error(mensajeDeSubida(uploadError, archivo));
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

// Borra el archivo: primero el objeto del storage y luego su fila. Si el objeto ya no estuviera
// en el bucket, igual se borra la fila (no dejar metadata huérfana apuntando a algo inexistente).
export const eliminarArchivoExpediente = async ({ id, rutaArchivo }) => {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([rutaArchivo]);
  if (storageError) {
    console.error("Error borrando archivo de Storage:", storageError);
    throw new Error("No se pudo borrar el archivo del almacenamiento.");
  }

  const { error } = await supabase.from("archivos_expediente").delete().eq("id", id);
  if (error) {
    console.error("Error borrando la referencia del archivo:", error);
    throw new Error("No se pudo borrar la referencia del archivo.");
  }
  return true;
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
