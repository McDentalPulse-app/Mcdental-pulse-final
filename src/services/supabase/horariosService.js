import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const mapHorario = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  diaSemana: row.dia_semana, // ISO: 1=lunes … 7=domingo
  horaEntrada: row.hora_entrada,
  horaSalida: row.hora_salida,
  toleranciaMin: row.tolerancia_min,
});

export const getHorarios = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("horarios").select("*").order("dia_semana", { ascending: true })
    );
    return rows.map(mapHorario);
  } catch (error) {
    console.error("Error al obtener horarios:", error);
    throw new Error("No se pudieron cargar los horarios.", { cause: error });
  }
};

/**
 * Fija el horario de un empleado para un día.
 *
 * upsert sobre (empleado_id, dia_semana), que es el índice único de la migración 035:
 * la rejilla de horarios edita celdas, y "poner el lunes a las 9" tiene que ser la
 * misma operación tanto si ya había un lunes como si no.
 */
export const upsertHorario = async ({ empleadoId, diaSemana, horaEntrada, horaSalida, toleranciaMin }) => {
  const { data, error } = await supabase
    .from("horarios")
    .upsert(
      {
        empleado_id: empleadoId,
        dia_semana: diaSemana,
        hora_entrada: horaEntrada,
        hora_salida: horaSalida,
        tolerancia_min: toleranciaMin ?? 10,
      },
      { onConflict: "empleado_id,dia_semana" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error guardando el horario:", error);
    throw new Error("No se pudo guardar el horario.");
  }
  return mapHorario(data);
};

/**
 * Quita el horario de un día.
 *
 * Aquí borrar SÍ es lo correcto, a diferencia del resto de la app: la ausencia de
 * renglón es exactamente cómo se dice "este empleado ya no trabaja los sábados"
 * (migración 035). No se destruye un registro histórico, se cambia una configuración.
 */
export const deleteHorario = async (id) => {
  const { error } = await supabase.from("horarios").delete().eq("id", id);

  if (error) {
    console.error("Error eliminando el horario:", error);
    throw new Error("No se pudo quitar el horario.");
  }
};
