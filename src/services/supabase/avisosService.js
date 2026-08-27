import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const BUCKET_VIDEOS = "avisos-videos";
const VIDEO_TAM_MAX = 209715200; // 200 MB, mismo tope que el bucket (migraciones 129/130)

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

export const addAviso = async ({ titulo, cuerpo, creadoPor, sucursales, videoUrl }) => {
  const { data, error } = await supabase
    .from("avisos")
    .insert({ titulo, cuerpo, creado_por: creadoPor, sucursales, video_url: videoUrl || null })
    .select(SELECT_AVISO)
    .single();

  if (error) {
    console.error("Error guardando el aviso:", error);
    throw new Error("No se pudo guardar el aviso.");
  }
  return mapAviso(data);
};

export const updateAviso = async ({ id, titulo, cuerpo, sucursales, videoUrl }) => {
  const { data, error } = await supabase
    .from("avisos")
    .update({ titulo, cuerpo, sucursales, video_url: videoUrl || null })
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

// Video adjunto (migración 129/130). Se sube al TOCAR EL ARCHIVO, no al publicar — el path
// es un id propio (crypto.randomUUID()), no el del aviso, porque un aviso nuevo todavía no
// tiene id en ese momento. Publicar/Guardar solo escribe la URL ya subida, así que es
// instantáneo. El nombre de archivo real no importa para nada más — nadie lo vuelve a
// necesitar salvo para poder borrarlo si se aprieta "Quitar video".
//
// Con XMLHttpRequest, no fetch: el cliente de Storage usa fetch() por dentro, y fetch NO
// da progreso de subida en el navegador (ninguno, ni con trucos de stream) — así que ni
// se podía enseñar un avance real ni, más grave, se podía asegurar que un error de verdad
// (413 por pasarse del tope, por ejemplo) llegara a mostrarse: xhr.onerror/onload siempre
// disparan, no hay forma de que esto se quede pensando para siempre sin avisar.
export const subirVideoAviso = (archivo, onProgreso) =>
  new Promise((resolve, reject) => {
    if (archivo.type !== "video/mp4") {
      reject(new Error("Solo se aceptan videos en formato MP4."));
      return;
    }
    if (archivo.size > VIDEO_TAM_MAX) {
      reject(new Error("El video pesa más de 200 MB. Comprímelo o recórtalo antes de subirlo."));
      return;
    }

    supabase.auth.getSession().then(({ data: sesion }) => {
      const token = sesion?.session?.access_token;
      if (!token) {
        reject(new Error("Tu sesión expiró. Vuelve a iniciar sesión e inténtalo de nuevo."));
        return;
      }

      const ruta = `${crypto.randomUUID()}.mp4`;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET_VIDEOS}/${ruta}`;

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_ANON_KEY);
      xhr.setRequestHeader("Content-Type", "video/mp4");
      xhr.setRequestHeader("x-upsert", "true");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgreso) onProgreso(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const { data } = supabase.storage.from(BUCKET_VIDEOS).getPublicUrl(ruta);
          resolve({ videoUrl: `${data.publicUrl}?v=${Date.now()}`, videoPath: ruta });
          return;
        }
        let mensaje = "No se pudo subir el video.";
        if (xhr.status === 413) {
          mensaje = "El video pesa más de 200 MB. Comprímelo o recórtalo antes de subirlo.";
        } else {
          try {
            const cuerpo = JSON.parse(xhr.responseText);
            if (cuerpo?.message) mensaje = cuerpo.message;
          } catch { /* respuesta no era JSON, se queda el mensaje genérico */ }
        }
        console.error("Error subiendo video de aviso:", xhr.status, xhr.responseText);
        reject(new Error(mensaje));
      };
      xhr.onerror = () => reject(new Error("No se pudo subir el video: fallo de red."));
      xhr.ontimeout = () => reject(new Error("La subida del video tardó demasiado y se canceló."));
      xhr.timeout = 10 * 60 * 1000; // 10 min: un video de 200 MB en mala conexión puede tardar
      xhr.send(archivo);
    }).catch(() => reject(new Error("No se pudo verificar tu sesión.")));
  });

// Borra un video recién subido que todavía no quedó ligado a ningún aviso (se arrepintieron
// antes de publicar) o el de un aviso existente. Best-effort: si el objeto ya no existe o
// falla la red, no importa — un archivo huérfano en Storage no es problema; lo que sí lo
// sería es que esto bloquee al usuario por un error de limpieza.
export const borrarVideoStorage = async (videoPath) => {
  if (!videoPath) return;
  await supabase.storage.from(BUCKET_VIDEOS).remove([videoPath]).catch(() => {});
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
