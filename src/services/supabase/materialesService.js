import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";
import { comprimirImagen } from "../../utils/imagen";

const BUCKET_FOTOS = "materiales-fotos";

const mapMaterial = (row) => ({
  id: row.id,
  nombre: row.nombre,
  unidadMedida: row.unidad_medida,
  umbralStockBajo: Number(row.umbral_stock_bajo),
  activo: row.activo,
  imagenUrl: row.imagen_url,
});

export const getMateriales = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("materiales").select("*").order("nombre", { ascending: true }),
    );
    return rows.map(mapMaterial);
  } catch (error) {
    console.error("Error al obtener materiales:", error);
    throw new Error("No se pudo cargar el catálogo de materiales.", { cause: error });
  }
};

export const addMaterial = async ({ nombre, unidadMedida, umbralStockBajo }) => {
  const limpio = (nombre || "").trim();
  if (!limpio) throw new Error("Escribe el nombre del material.");

  const { data, error } = await supabase
    .from("materiales")
    .insert({
      nombre: limpio,
      unidad_medida: unidadMedida,
      umbral_stock_bajo: umbralStockBajo ?? 0,
    })
    .select()
    .single();

  if (error) {
    // 23505 = nombre duplicado (índice único).
    if (error.code === "23505") throw new Error("Ya existe un material con ese nombre.");
    console.error("Error creando material:", error);
    throw new Error("No se pudo crear el material.");
  }
  return mapMaterial(data);
};

export const updateMaterial = async ({ id, nombre, unidadMedida, umbralStockBajo, activo }) => {
  const { data, error } = await supabase
    .from("materiales")
    .update({
      ...(nombre === undefined ? {} : { nombre: nombre.trim() }),
      ...(unidadMedida === undefined ? {} : { unidad_medida: unidadMedida }),
      ...(umbralStockBajo === undefined ? {} : { umbral_stock_bajo: umbralStockBajo }),
      ...(activo === undefined ? {} : { activo }),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un material con ese nombre.");
    console.error("Error actualizando material:", error);
    throw new Error("No se pudo actualizar el material.");
  }
  return mapMaterial(data);
};

// Borrado real (decisión del dueño, 2026-08-26): si el material ya tuvo movimientos de
// stock, se van con él (inventario_sucursal e inventario_movimientos están en
// `on delete cascade`, migración 121). Si ya se pidió alguna vez, la base lo rechaza
// (pedido_items está en `on delete restrict`) — ese caso se traduce a un mensaje claro.
export const eliminarMaterial = async (id) => {
  const { error } = await supabase.from("materiales").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("No se puede eliminar: este material ya está en un pedido.");
    }
    console.error("Error eliminando material:", error);
    throw new Error("No se pudo eliminar el material.");
  }
};

// Mismo patrón que subirAvatarUsuario (avatarService.js): comprime, sube con upsert (una
// ruta fija por material, sin acumular versiones), cache-bust y guarda la URL en la fila.
export const subirImagenMaterial = async (materialId, archivo) => {
  if (!archivo.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen (JPG, PNG, etc.).");
  }

  const blobComprimido = await comprimirImagen(archivo, 400);
  const ruta = `${materialId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(ruta, blobComprimido, { upsert: true, contentType: "image/jpeg" });
  if (uploadError) {
    console.error("Error subiendo foto de material:", uploadError);
    throw new Error("No se pudo subir la foto.");
  }

  const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta);
  const imagenUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabase
    .from("materiales")
    .update({ imagen_url: imagenUrl })
    .eq("id", materialId);
  if (dbError) {
    console.error("Error guardando imagen_url:", dbError);
    throw new Error("La foto se subió pero no se pudo guardar en el material.");
  }

  return imagenUrl;
};
