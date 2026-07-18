import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const SELECT_CON_AUTOR = "*, usuarios(name)";

const mapAviso = (row) => ({
  id: row.id,
  titulo: row.titulo,
  cuerpo: row.cuerpo,
  creadoPor: row.creado_por,
  autor: row.usuarios?.name,
  sucursales: row.sucursales || [],
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
      supabase.from("avisos").select(SELECT_CON_AUTOR).order("created_at", { ascending: false })
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
    .select(SELECT_CON_AUTOR)
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
    .select(SELECT_CON_AUTOR)
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
