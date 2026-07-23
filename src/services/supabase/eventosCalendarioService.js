import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const mapEvento = (row) => ({
  id: row.id,
  titulo: row.titulo,
  descripcion: row.descripcion,
  fecha: row.fecha,
  horaInicio: row.hora_inicio ? row.hora_inicio.slice(0, 5) : null, // "HH:MM"
  horaFin: row.hora_fin ? row.hora_fin.slice(0, 5) : null,
  todoElDia: row.todo_el_dia,
  color: row.color,
  ubicacion: row.ubicacion,
  creadoPor: row.creado_por,
});

const toRow = (e) => ({
  titulo: e.titulo?.trim(),
  descripcion: e.descripcion?.trim() || null,
  fecha: e.fecha,
  hora_inicio: e.todoElDia ? null : (e.horaInicio || null),
  hora_fin: e.todoElDia ? null : (e.horaFin || null),
  todo_el_dia: !!e.todoElDia,
  color: e.color || "azul",
  ubicacion: e.ubicacion?.trim() || null,
});

export const getEventosCalendario = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("eventos_calendario").select("*").order("fecha", { ascending: true }),
    );
    return rows.map(mapEvento);
  } catch (error) {
    console.error("Error al obtener eventos del calendario:", error);
    throw new Error("No se pudieron cargar los eventos.", { cause: error });
  }
};

export const addEventoCalendario = async (evento, creadoPor) => {
  const { data, error } = await supabase
    .from("eventos_calendario")
    .insert({ ...toRow(evento), creado_por: creadoPor || null })
    .select("*")
    .single();
  if (error) {
    console.error("Error creando evento:", error);
    throw new Error("No se pudo crear el evento.");
  }
  return mapEvento(data);
};

export const updateEventoCalendario = async (id, evento) => {
  const { data, error } = await supabase
    .from("eventos_calendario")
    .update(toRow(evento))
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("Error actualizando evento:", error);
    throw new Error("No se pudo actualizar el evento.");
  }
  return mapEvento(data);
};

export const deleteEventoCalendario = async (id) => {
  const { error } = await supabase.from("eventos_calendario").delete().eq("id", id);
  if (error) {
    console.error("Error eliminando evento:", error);
    throw new Error("No se pudo eliminar el evento.");
  }
};
