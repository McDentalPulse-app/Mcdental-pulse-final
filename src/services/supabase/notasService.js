import { supabase } from "../../config/supabase";

const mapNota = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  autorId: row.autor_id,
  autor: row.autor_nombre,
  texto: row.texto,
  fecha: row.fecha,
});

// Gateado por RLS a psicologa/admin.
export const getNotasPsicologicas = async () => {
  const { data, error } = await supabase.from("notas_psicologicas").select("*");
  if (error) {
    console.error("Error al obtener notas psicológicas:", error);
    throw new Error("No se pudieron cargar las notas.");
  }
  return data.map(mapNota);
};

export const addNota = async ({ empleadoId, autorId, autor, texto }) => {
  const { data, error } = await supabase
    .from("notas_psicologicas")
    .insert({ empleado_id: empleadoId, autor_id: autorId, autor_nombre: autor, texto })
    .select()
    .single();

  if (error) {
    console.error("Error guardando nota psicológica:", error);
    throw new Error("No se pudo guardar la nota.");
  }
  return mapNota(data);
};
