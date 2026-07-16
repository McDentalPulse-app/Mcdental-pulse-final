import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const SELECT_CON_AUTOR = "*, usuarios(name)";

const mapAviso = (row) => ({
  id: row.id,
  titulo: row.titulo,
  cuerpo: row.cuerpo,
  creadoPor: row.creado_por,
  autor: row.usuarios?.name,
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

export const addAviso = async ({ titulo, cuerpo, creadoPor }) => {
  const { data, error } = await supabase
    .from("avisos")
    .insert({ titulo, cuerpo, creado_por: creadoPor })
    .select(SELECT_CON_AUTOR)
    .single();

  if (error) {
    console.error("Error guardando el aviso:", error);
    throw new Error("No se pudo guardar el aviso.");
  }
  return mapAviso(data);
};

export const updateAviso = async ({ id, titulo, cuerpo }) => {
  const { data, error } = await supabase
    .from("avisos")
    .update({ titulo, cuerpo })
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
  const { data, error } = await supabase
    .from("avisos_leidos")
    .insert({ aviso_id: avisoId, usuario_id: usuarioId })
    .select()
    .single();

  if (error) {
    console.error("Error marcando el aviso como leído:", error);
    throw new Error("No se pudo marcar el aviso como leído.");
  }
  return mapLeido(data);
};
