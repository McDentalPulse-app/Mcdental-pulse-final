import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const BUCKET_VIDEOS = "avisos-videos";
const VIDEO_TAM_MAX = 52428800; // 50 MB, mismo tope que el bucket (migración 129)

// La firma del autor vive en columnas de `avisos` (autor_nombre/autor_rol, migración 084) y
// no en un join a `usuarios`: la RLS de esa tabla solo deja a cada quien leer su propia fila,
// así que al empleado — justo a quien va dirigido el aviso — el join le volvía vacío y la
// pantalla decía "—". De paso, la firma ahora también llega por realtime: un join no viaja
// en el payload de un INSERT, las columnas propias sí.
const SELECT_AVISO = "*";

const mapAviso = (row) => ({
  id: row.id,
  titulo: row.titulo,
  cuerpo: row.cuerpo,
  creadoPor: row.creado_por,
  autor: row.autor_nombre,
  autorRol: row.autor_rol,
  sucursales: row.sucursales || [],
  videoUrl: row.video_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapLeido = (row) => ({
  id: row.id,
  avisoId: row.aviso_id,
  usuarioId: row.usuario_id,
  leidoEn: row.leido_en,
});

export const getAvisos = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("avisos").select(SELECT_AVISO).order("created_at", { ascending: false })
    );
    return rows.map(mapAviso);
  } catch (error) {
    console.error("Error al obtener avisos:", error);
    throw new Error("No se pudieron cargar los avisos.", { cause: error });
  }
};

// RLS ya acota esto a las propias filas del usuario que llama (avisos_leidos_select_propia,
// migración 058): no hace falta filtrar por usuarioId aquí.
export const getAvisosLeidos = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("avisos_leidos").select("*"));
    return rows.map(mapLeido);
  } catch (error) {
    console.error("Error al obtener los avisos leídos:", error);
    throw new Error("No se pudieron cargar los avisos leídos.", { cause: error });
  }
};

// Realtime: para que un aviso nuevo aparezca sin recargar (patrón calcado de
// subscribeEncuestas en encuestasService.js).
export const subscribeAvisos = (onInsert) => {
  const channel = supabase
    .channel("avisos-inserts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "avisos" },
      (payload) => onInsert(mapAviso(payload.new))
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const addAviso = async ({ titulo, cuerpo, creadoPor, sucursales }) => {
  const { data, error } = await supabase
    .from("avisos")
    .insert({ titulo, cuerpo, creado_por: creadoPor, sucursales })
    .select(SELECT_AVISO)
    .single();

  if (error) {
    console.error("Error guardando el aviso:", error);
    throw new Error("No se pudo guardar el aviso.");
  }
  return mapAviso(data);
};

export const updateAviso = async ({ id, titulo, cuerpo, sucursales }) => {
  const { data, error } = await supabase
    .from("avisos")
    .update({ titulo, cuerpo, sucursales })
    .eq("id", id)
    .select(SELECT_AVISO)
    .single();

  if (error) {
    console.error("Error actualizando el aviso:", error);
    throw new Error("No se pudo actualizar el aviso.");
  }
  return mapAviso(data);
};

export const deleteAviso = async (id) => {
  const { error } = await supabase.from("avisos").delete().eq("id", id);

  if (error) {
    console.error("Error eliminando el aviso:", error);
    throw new Error("No se pudo eliminar el aviso.");
  }
};

// Video adjunto (migración 129). Mismo patrón de dos pasos que subirImagenMaterial: el
// aviso ya existe (necesitamos su id para nombrar el archivo), acá solo se le pone el
// video. Solo MP4 y 50 MB — el bucket lo hace cumplir igual del lado del servidor, esto
// evita hacer esperar la subida entera para enterarse de que iba a fallar.
export const subirVideoAviso = async (avisoId, archivo) => {
  if (archivo.type !== "video/mp4") {
    throw new Error("Solo se aceptan videos en formato MP4.");
  }
  if (archivo.size > VIDEO_TAM_MAX) {
    throw new Error("El video pesa más de 50 MB. Comprímelo o recórtalo antes de subirlo.");
  }

  const ruta = `${avisoId}.mp4`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_VIDEOS)
    .upload(ruta, archivo, { upsert: true, contentType: "video/mp4" });
  if (uploadError) {
    console.error("Error subiendo video de aviso:", uploadError);
    throw new Error("No se pudo subir el video.");
  }

  const { data } = supabase.storage.from(BUCKET_VIDEOS).getPublicUrl(ruta);
  const videoUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabase
    .from("avisos")
    .update({ video_url: videoUrl })
    .eq("id", avisoId);
  if (dbError) {
    console.error("Error guardando video_url:", dbError);
    throw new Error("El video se subió pero no se pudo guardar en el aviso.");
  }

  return videoUrl;
};

// Quita el video de un aviso sin tocar el resto. Borrar el objeto del bucket es
// best-effort: si falla (ya no existía, red, lo que sea) igual se limpia la columna — un
// archivo huérfano en Storage no es un problema, un aviso que sigue enseñando un video que
// ya nadie quiere ahí, sí.
export const quitarVideoAviso = async (avisoId, videoUrl) => {
  if (videoUrl) {
    const ruta = `${avisoId}.mp4`;
    await supabase.storage.from(BUCKET_VIDEOS).remove([ruta]).catch(() => {});
  }

  const { error } = await supabase
    .from("avisos")
    .update({ video_url: null })
    .eq("id", avisoId);
  if (error) {
    console.error("Error quitando el video del aviso:", error);
    throw new Error("No se pudo quitar el video.");
  }
};

export const marcarAvisoLeido = async (avisoId, usuarioId) => {
  // Idempotente: si el aviso ya estaba marcado como leído, esto NO es un error — el
  // aviso está leído igual y el modal debe cerrarse. Antes, un `insert().select().single()`
  // fallaba en el segundo intento con "duplicate key" (23505) y dejaba el modal atrapado.
  // `upsert` con ignoreDuplicates hace un INSERT ... ON CONFLICT DO NOTHING; sin `.select()`
  // no dependemos de que el RETURNING pase RLS, construimos el "leído" en el cliente.
  const { error } = await supabase
    .from("avisos_leidos")
    .upsert(
      { aviso_id: avisoId, usuario_id: usuarioId },
      { onConflict: "aviso_id,usuario_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("Error marcando el aviso como leído:", error);
    throw new Error("No se pudo marcar el aviso como leído.");
  }
  return { id: null, avisoId, usuarioId, leidoEn: new Date().toISOString() };
};
