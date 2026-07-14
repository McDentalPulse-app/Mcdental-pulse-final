import { supabase } from "../../config/supabase";
import { comprimirImagen } from "../../utils/imagen";

const BUCKET = "avatars";
const MAX_DIMENSION = 400;

export const subirAvatarUsuario = async (usuarioId, archivo) => {
  if (!archivo.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen (JPG, PNG, etc.).");
  }

  // Comprime en el navegador antes de subir — evita que alguien suba una foto de
  // varios MB sin querer (el bucket igual tiene un tope server-side de 2MB como red
  // de seguridad, ver migración 00000000000021). La función vive en utils/imagen.js
  // porque el checador la reusa para las selfies.
  const blobComprimido = await comprimirImagen(archivo, MAX_DIMENSION);
  const ruta = `${usuarioId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blobComprimido, { upsert: true, contentType: "image/jpeg" });
  if (uploadError) {
    console.error("Error subiendo avatar:", uploadError);
    throw new Error("No se pudo subir la foto de perfil.");
  }

  // Cache-busting: la URL pública es siempre la misma ruta, pero el archivo
  // cambia en cada subida — sin esto el navegador podría seguir mostrando
  // la foto vieja desde caché.
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabase
    .from("usuarios")
    .update({ avatar_url: avatarUrl })
    .eq("id", usuarioId);
  if (dbError) {
    console.error("Error guardando avatar_url:", dbError);
    throw new Error("La foto se subió pero no se pudo guardar en el perfil.");
  }

  return avatarUrl;
};

export const quitarAvatarUsuario = async (usuarioId) => {
  const ruta = `${usuarioId}.jpg`;

  const { error: removeError } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (removeError) {
    console.error("Error eliminando avatar del storage:", removeError);
    throw new Error("No se pudo quitar la foto de perfil.");
  }

  const { error: dbError } = await supabase
    .from("usuarios")
    .update({ avatar_url: null })
    .eq("id", usuarioId);
  if (dbError) {
    console.error("Error limpiando avatar_url:", dbError);
    throw new Error("La foto se borró pero no se pudo actualizar el perfil.");
  }
};
