import { supabase } from "../../config/supabase";
import { comprimirImagen } from "../../utils/imagen";

const BUCKET = "banners";
// Un banner se ve a todo lo ancho de la tarjeta, así que 400px (lo que usa el avatar) se
// vería lavado. 1200 da para pantallas grandes sin acercarse al tope de 2MB del bucket.
const MAX_DIMENSION = 1200;

// Portada de Mi perfil. Mismo patrón que avatarService: el archivo se llama con el id del
// usuario, así que la ruta es la que ata la imagen a su dueño en las policies del bucket
// (ver migración 00000000000097).
export const subirBannerUsuario = async (usuarioId, archivo) => {
  if (!archivo.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen (JPG, PNG, etc.).");
  }

  const blobComprimido = await comprimirImagen(archivo, MAX_DIMENSION);
  const ruta = `${usuarioId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blobComprimido, { upsert: true, contentType: "image/jpeg" });
  if (uploadError) {
    console.error("Error subiendo el banner:", uploadError);
    throw new Error("No se pudo subir la portada.");
  }

  // Cache-busting: la ruta no cambia entre subidas, así que sin el parámetro el navegador
  // seguiría mostrando la portada anterior.
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  const bannerUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { data: filas, error: dbError } = await supabase
    .from("usuarios")
    .update({ banner_url: bannerUrl })
    .eq("id", usuarioId)
    .select("id");
  if (dbError) {
    console.error("Error guardando banner_url:", dbError);
    throw new Error("La portada se subió pero no se pudo guardar en el perfil.");
  }
  // Un update que RLS deja en cero filas vuelve sin error: sin esto la app diría que
  // guardó una portada que en realidad no quedó registrada.
  if (!filas?.length) {
    throw new Error("La portada se subió pero no se pudo guardar en el perfil.");
  }

  return bannerUrl;
};

export const quitarBannerUsuario = async (usuarioId) => {
  const ruta = `${usuarioId}.jpg`;

  const { error: removeError } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (removeError) {
    console.error("Error eliminando el banner del storage:", removeError);
    throw new Error("No se pudo quitar la portada.");
  }

  const { error: dbError } = await supabase
    .from("usuarios")
    .update({ banner_url: null })
    .eq("id", usuarioId);
  if (dbError) {
    console.error("Error limpiando banner_url:", dbError);
    throw new Error("La portada se borró pero no se pudo actualizar el perfil.");
  }
};
