import { supabase } from "../../config/supabase";

const mapEncuesta = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  semana: row.semana,
  respuestas: row.respuestas,
  score: row.score,
  semaforo: row.semaforo,
  fecha: row.fecha,
});

export const getEncuestas = async () => {
  const { data, error } = await supabase.from("encuestas").select("*");
  if (error) {
    console.error("Error al obtener encuestas:", error);
    throw new Error("No se pudieron cargar las encuestas.");
  }
  return data.map(mapEncuesta);
};

// Suscripción realtime a nuevas encuestas. Requiere que la tabla esté en la
// publicación supabase_realtime (migración 24); si no lo está, el canal queda
// suscrito pero mudo y el polling del GlobalContext cubre la sincronización.
export const subscribeEncuestas = (onInsert) => {
  const channel = supabase
    .channel("encuestas-inserts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "encuestas" },
      (payload) => onInsert(mapEncuesta(payload.new))
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const addEncuesta = async ({ empleadoId, semana, respuestas, score, semaforo, fecha }) => {
  const { data, error } = await supabase
    .from("encuestas")
    .insert({ empleado_id: empleadoId, semana, respuestas, score, semaforo, fecha })
    .select()
    .single();

  if (error) {
    console.error("Error guardando encuesta:", error);
    throw new Error("No se pudo guardar la encuesta.");
  }
  return mapEncuesta(data);
};
