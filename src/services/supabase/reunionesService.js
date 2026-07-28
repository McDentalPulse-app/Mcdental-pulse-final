import { supabase } from "../../config/supabase";

const mapReunion = (row) => ({
  id: row.id,
  titulo: row.titulo,
  descripcion: row.descripcion,
  inicio: row.inicio,
  fin: row.fin,
  estado: row.estado,
  creadoPor: row.creado_por,
  invitados: (row.reunion_invitados || []).map((i) => ({
    usuarioId: i.usuario_id,
    estado: i.estado,
  })),
});

/**
 * Reuniones que me tocan.
 *
 * No hace falta filtrar por usuario: la RLS (`reuniones_select_participante`) ya devuelve solo
 * las que convoqué o a las que estoy invitado. Filtrar además en el cliente daría la falsa
 * impresión de que la seguridad vive aquí.
 *
 * `sala` NO se pide a propósito: el identificador de la sala solo lo entrega
 * api/reunion-token.js junto al token, y solo a quien tiene derecho. Traerlo en la lista lo
 * dejaría en el navegador de todo el que abra la pantalla.
 */
export const getReuniones = async () => {
  const { data, error } = await supabase
    .from("reuniones")
    .select("id, titulo, descripcion, inicio, fin, estado, creado_por, reunion_invitados(usuario_id, estado)")
    .order("inicio", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Error al obtener reuniones:", error);
    return [];
  }
  return (data || []).map(mapReunion);
};

/** Convocar. Pasa por el servidor: ver api/crear-reunion.js. */
export const crearReunion = async ({ titulo, descripcion, inicio, fin, invitados }) => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/crear-reunion", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ titulo, descripcion, inicio, fin, invitados }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error || "No se pudo crear la reunión.");
  return mapReunion(cuerpo.reunion);
};

/**
 * Pide el permiso para entrar a la sala.
 *
 * Es la única vía: el servidor comprueba que estoy invitado y devuelve el token, la sala y el
 * dominio. Sin esta llamada no hay forma de saber siquiera cómo se llama la sala.
 */
export const getAccesoReunion = async (reunionId) => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/reunion-token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reunionId }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error || "No se pudo entrar a la reunión.");
  return cuerpo;
};

/** Aceptar o rechazar la invitación. Es lo único que un invitado puede cambiar de su fila. */
export const responderInvitacion = async ({ reunionId, usuarioId, estado }) => {
  const { error } = await supabase
    .from("reunion_invitados")
    .update({ estado })
    .eq("reunion_id", reunionId)
    .eq("usuario_id", usuarioId);
  if (error) throw new Error("No se pudo responder a la invitación.");
};

/** Realtime: una invitación nueva o una respuesta aparecen sin recargar. */
export const subscribeReuniones = (usuarioId, onCambio) => {
  if (!usuarioId) return () => {};
  const channel = supabase
    .channel(`reuniones-${usuarioId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "reuniones" }, () => onCambio())
    .on("postgres_changes", { event: "*", schema: "public", table: "reunion_invitados" }, () => onCambio())
    .subscribe();
  return () => supabase.removeChannel(channel);
};
