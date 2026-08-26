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

  // Y de cada TIPO de crítica, solo la más reciente.
  //
  // Las críticas se fijan arriba del todo, estén leídas o no —a propósito: marcar leída no
  // resuelve el problema—. Pero la tarea de fondo las reemite mientras el problema exista, y
  // sin esto se apilan: en producción había SEIS avisos del mismo respaldo caído ocupando los
  // seis primeros lugares del panel. Todo lo que llegaba después quedaba debajo, así que la
  // campana parecía congelada aunque las notificaciones nuevas entraban bien.
  //
  // Una es la señal; seis son un tapón. Se conserva la más reciente porque es la que trae el
  // dato al día ("6 días sin copia" en vez de "desde hace días"). Van ordenadas de más nueva a
  // más vieja, así que la primera de cada tipo es la que se queda.
  const tiposCriticos = new Set();
  const sinRepetir = unicas.filter((n) => {
    if (!n.critica) return true;
    if (tiposCriticos.has(n.tipo)) return false;
    tiposCriticos.add(n.tipo);
    return true;
  });

  return sinRepetir.map(map).sort((a, b) => {
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
 * Vacía la bandeja del usuario, PERO conserva las críticas vigentes.
 *
 * Esa excepción es el punto: una alerta de un problema sin resolver no debe poder despacharse
 * con un botón. Es exactamente lo que dejó el respaldo externo seis días caído con los avisos
 * leídos. Las críticas viejas (>48 h) sí se van; si el problema sigue, la tarea de fondo las
 * vuelve a emitir en menos de un día.
 *
 * La RLS (migración 114) limita el borrado a las filas propias, así que no hace falta filtrar
 * por empleado_id: la base no dejaría borrar las de otro aunque se pidiera.
 */
export const limpiarNotificaciones = async () => {
  const desde = new Date(Date.now() - HORAS_CRITICA_VIGENTE * 3_600_000).toISOString();
  const { error } = await supabase
    .from("notificaciones")
    .delete()
    .or(`critica.eq.false,creada_en.lt.${desde}`);
  if (error) throw new Error("No se pudieron limpiar las notificaciones.");
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
