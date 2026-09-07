import { supabase } from "../../config/supabase";
import { rutaSegura, mimeDeArchivo } from "../../utils/archivo";

// Calco de archivosExpedienteService.js: mismo patrón de ruta segura, contentType
// explícito, mensaje de subida traducido y signed URL — solo cambia el bucket.
const BUCKET = "responsabilidades";
const MAX_BYTES = 10 * 1024 * 1024;

const mensajeDeSubida = (error) => {
  const texto = `${error?.message || ""} ${error?.error || ""}`.toLowerCase();
  if (texto.includes("mime")) {
    return "Ese departamento solo acepta PDF o Word para su archivo de responsabilidades.";
  }
  if (texto.includes("exceeded") || texto.includes("too large") || texto.includes("payload")) {
    return "El archivo excede el límite de 10 MB permitido.";
  }
  if (texto.includes("row-level security") || texto.includes("unauthorized")) {
    return "Tu cuenta no tiene permiso para subir el archivo de este departamento.";
  }
  return `No se pudo subir el archivo. ${error?.message || ""}`.trim();
};

/**
 * Sube (o reemplaza) el archivo de responsabilidades de un área. Orden a propósito: subir el
 * nuevo, actualizar la fila de `areas`, y RECIÉN AHÍ borrar el objeto viejo — si el borrado
 * falla queda un huérfano en el bucket, que es mejor que una fila apuntando a nada.
 */
export const subirResponsabilidades = async ({ areaId, archivo, subidoPor, rutaVieja }) => {
  if (archivo.size > MAX_BYTES) {
    throw new Error("El archivo excede el límite de 10 MB permitido.");
  }

  const ruta = `${areaId}/${Date.now()}-${rutaSegura(archivo.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { upsert: false, contentType: mimeDeArchivo(archivo) });

  if (uploadError) {
    console.error("Error subiendo responsabilidades a Storage:", uploadError);
    throw new Error(mensajeDeSubida(uploadError));
  }

  // areasService.guardarArea() no conoce las columnas de archivo (es genérico para
  // nombre/orden/color) — se actualizan directo acá, es la única escritura de este
  // módulo que las toca.
  const { data, error } = await supabase
    .from("areas")
    .update({
      archivo_nombre: archivo.name,
      archivo_ruta: ruta,
      archivo_subido_por: subidoPor,
      archivo_subido_en: new Date().toISOString(),
    })
    .eq("id", areaId)
    .select()
    .single();

  if (error) {
    console.error("Error registrando el archivo de responsabilidades:", error);
    throw new Error("El archivo se subió, pero no se pudo guardar su referencia.");
  }

  if (rutaVieja && rutaVieja !== ruta) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([rutaVieja]);
    if (removeError) {
      // No se relanza: el archivo nuevo ya quedó bien. Solo se avisa por consola que
      // quedó un huérfano en el bucket, para limpieza manual si hace falta.
      console.error("No se pudo borrar el archivo anterior (queda huérfano en el bucket):", removeError);
    }
  }

  return data;
};

export const eliminarResponsabilidades = async ({ areaId, ruta }) => {
  if (ruta) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([ruta]);
    if (removeError) {
      console.error("Error borrando archivo de Storage:", removeError);
      throw new Error("No se pudo borrar el archivo del almacenamiento.");
    }
  }
  const { error } = await supabase
    .from("areas")
    .update({ archivo_nombre: null, archivo_ruta: null, archivo_subido_por: null, archivo_subido_en: null })
    .eq("id", areaId);
  if (error) {
    console.error("Error limpiando la referencia del archivo:", error);
    throw new Error("No se pudo borrar la referencia del archivo.");
  }
  return true;
};

// El bucket es privado: no hay URL pública persistida, se genera on-demand.
export const getSignedUrlResponsabilidades = async (ruta, expiresInSeconds = 300) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, expiresInSeconds);
  if (error) {
    console.error("Error generando signed URL de responsabilidades:", error);
    throw new Error("No se pudo generar el enlace del archivo.");
  }
  return data.signedUrl;
};
