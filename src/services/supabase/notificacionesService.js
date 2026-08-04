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
  critica: !!row.critica,
  creadaEn: row.creada_en,
});

/** Ventana en la que un aviso crítico se considera VIGENTE. Ver migración 110: no hay estado
 *  que mantener — las tareas de fondo lo vuelven a emitir cada día mientras el problema exista,
 *  así que dejar de verlo 48 h después es la señal de que se arregló. */
const HORAS_CRITICA_VIGENTE = 48;

/**
 * Las últimas N, más recientes primero — pero las CRÍTICAS VIGENTES van delante, estén leídas
 * o no.
 *
 * Se piden en dos consultas y no en una: una crítica de hace tres días no entra en "las 20 más
 * recientes" cuando ese día hubo cincuenta recordatorios de encuesta, que es exactamente cómo
 * se enterró el aviso del respaldo. Pedirlas aparte garantiza que estén.
 */
export const getNotificaciones = async (limite = 20) => {
  const desde = new Date(Date.now() - HORAS_CRITICA_VIGENTE * 3_600_000).toISOString();

  const [recientes, criticas] = await Promise.all([
    supabase.from("notificaciones").select("*")
      .order("creada_en", { ascending: false }).limit(limite),
    supabase.from("notificaciones").select("*")
      .eq("critica", true).gte("creada_en", desde)
      .order("creada_en", { ascending: false }),
  ]);

  if (recientes.error) throw new Error("No se pudieron cargar las notificaciones.");
  // Si falla la consulta de críticas no se tumba la campana entera: es peor quedarse sin
  // notificaciones que quedarse sin el destacado.
  if (criticas.error) console.error("Error cargando las críticas:", criticas.error);

  // Una crítica reciente sale en las dos consultas; se queda con una sola fila.
  const vistos = new Set();
  const unicas = [...(criticas.data || []), ...(recientes.data || [])].filter((n) => {
    if (vistos.has(n.id)) return false;
    vistos.add(n.id);
    return true;
  });

  return unicas.map(map).sort((a, b) => {
    if (a.critica !== b.critica) return a.critica ? -1 : 1;
    return String(b.creadaEn).localeCompare(String(a.creadaEn));
  });
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
