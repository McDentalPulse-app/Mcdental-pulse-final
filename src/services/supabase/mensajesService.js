import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const mapMensaje = (row) => ({
  id: row.id,
  de: row.de_id,
  para: row.para_id,
  texto: row.texto,
  leido: row.leido,
  fecha: row.fecha,
});

export const getMensajes = async () => {
  try {
    const rows = await fetchAll(() => supabase.from("mensajes").select("*"));
    return rows.map(mapMensaje);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    throw new Error("No se pudieron cargar los mensajes.", { cause: error });
  }
};

/**
 * Pasa por el SERVIDOR (api/enviar-mensaje.js), no por un insert directo: es lo que permite
 * avisar por push a quien recibe el mensaje, con la clave privada de VAPID que solo vive ahí.
 */
export const sendMensaje = async ({ para, texto, fecha }) => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/enviar-mensaje", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paraId: para, texto, fecha }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("Error guardando mensaje:", cuerpo.error);
    throw new Error(cuerpo.error || "No se pudo enviar el mensaje.");
  }
  return mapMensaje(cuerpo.mensaje);
};

export const marcarMensajeLeido = async (id) => {
  const { error } = await supabase.from("mensajes").update({ leido: true }).eq("id", id);
  if (error) {
    console.error("Error marcando mensaje como leído:", error);
    throw new Error("No se pudo marcar el mensaje como leído.");
  }
};
