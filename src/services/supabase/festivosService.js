import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const mapFestivo = (row) => ({
  id: row.id,
  fecha: row.fecha,
  nombre: row.nombre,
  tipo: row.tipo,
});

export const getFestivos = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("festivos").select("*").order("fecha", { ascending: true }),
    );
    return rows.map(mapFestivo);
  } catch (error) {
    console.error("Error al obtener festivos:", error);
    throw new Error("No se pudieron cargar los festivos.", { cause: error });
  }
};

// Alta/baja de festivos (solo gestión; el RLS lo garantiza). Van por el cliente autenticado:
// no necesitan la service role ni disparan avisos, a diferencia de los intercambios.
export const addFestivo = async ({ fecha, nombre, tipo = "empresa" }) => {
  const { data, error } = await supabase
    .from("festivos")
    .insert({ fecha, nombre, tipo })
    .select("*")
    .single();
  if (error) {
    console.error("Error agregando festivo:", error);
    throw new Error(error.code === "23505" ? "Ya hay un festivo en esa fecha." : "No se pudo agregar el festivo.");
  }
  return mapFestivo(data);
};

export const deleteFestivo = async (id) => {
  const { error } = await supabase.from("festivos").delete().eq("id", id);
  if (error) {
    console.error("Error eliminando festivo:", error);
    throw new Error("No se pudo eliminar el festivo.");
  }
};
