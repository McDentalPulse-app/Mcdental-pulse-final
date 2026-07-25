import { supabase } from "../../config/supabase";

/**
 * La bandeja de notificaciones, lado cliente. La RLS (migración 064) ya limita todo a las
 * filas del propio usuario, así que ninguna consulta de aquí necesita filtrar por empleado_id
 * a mano: la base no dejaría ver ni tocar las de otro aunque se pidiera.
 */

const map = (row) => ({
  id: row.id,
  tipo: row.tipo,
  titulo: row.titulo,
  cuerpo: row.cuerpo,
  url: row.url,
  leida: row.leida,
  creadaEn: row.creada_en,
});

/** Las últimas N, más recientes primero. */
export const getNotificaciones = async (limite = 20) => {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .order("creada_en", { ascending: false })
    .limit(limite);
  if (error) throw new Error("No se pudieron cargar las notificaciones.");
  return (data || []).map(map);
};

/** Cuántas sin leer (para el badge). head+count: cuenta sin traer filas. */
export const contarNoLeidas = async () => {
  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("leida", false);
  return count || 0;
};

export const marcarLeida = async (id) => {
  await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
};

export const marcarTodasLeidas = async () => {
  await supabase.from("notificaciones").update({ leida: true }).eq("leida", false);
};

/**
 * Realtime: avisa cuando algo cambia en las notificaciones de este usuario (llega una nueva, o
 * se marca leída en otra pestaña/dispositivo). El callback solo se dispara; quien escucha
 * vuelve a consultar — más simple que reconciliar cada payload, y el volumen es bajo.
 *
 * El filtro por empleado_id + la RLS aseguran que solo lleguen las suyas. Devuelve la función
 * para desuscribir, como subscribeAsistencias.
 */
export const subscribeNotificaciones = (empleadoId, onCambio) => {
  if (!empleadoId) return () => {};
  const channel = supabase
    .channel(`notificaciones-${empleadoId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notificaciones", filter: `empleado_id=eq.${empleadoId}` },
      () => onCambio()
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};
