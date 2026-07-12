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

export const sendMensaje = async ({ de, para, texto, fecha }) => {
  const payload = { de_id: de, para_id: para, texto };
  if (fecha) payload.fecha = fecha;

  const { data, error } = await supabase.from("mensajes").insert(payload).select().single();
  if (error) {
    console.error("Error guardando mensaje:", error);
    throw new Error("No se pudo enviar el mensaje.");
  }
  return mapMensaje(data);
};

export const marcarMensajeLeido = async (id) => {
  const { error } = await supabase.from("mensajes").update({ leido: true }).eq("id", id);
  if (error) {
    console.error("Error marcando mensaje como leído:", error);
    throw new Error("No se pudo marcar el mensaje como leído.");
  }
};
