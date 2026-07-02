import { supabase } from "../../config/supabase";
import { preguntaToRow } from "../../utils/encuestaPreguntas";

const toRow = (p) => {
  const base = preguntaToRow(p);
  return { texto: base.texto, tipo: base.tipo, area: base.area, opciones: base.opciones, orden: base.orden, activa: base.activa };
};

const fromRow = (row) => ({
  id: row.id,
  texto: row.texto,
  tipo: row.tipo,
  area: row.area,
  opciones: row.opciones,
  orden: row.orden,
  activa: row.activa,
});

// Actualiza las preguntas que ya tienen id (uuid real) y crea las que no lo tienen.
export const saveEncuestaPreguntas = async (preguntas) => {
  const existentes = preguntas.filter((p) => typeof p.id === "string");
  const nuevas = preguntas.filter((p) => typeof p.id !== "string");
  const resultados = [];

  if (existentes.length) {
    const rows = existentes.map((p) => ({ id: p.id, ...toRow(p) }));
    const { data, error } = await supabase.from("encuesta_preguntas").upsert(rows).select();
    if (error) {
      console.error("Error al actualizar preguntas de encuesta:", error);
      throw new Error(error.message || "No se pudieron guardar las preguntas.");
    }
    resultados.push(...data);
  }

  if (nuevas.length) {
    const rows = nuevas.map(toRow);
    const { data, error } = await supabase.from("encuesta_preguntas").insert(rows).select();
    if (error) {
      console.error("Error al crear preguntas de encuesta:", error);
      throw new Error(error.message || "No se pudieron guardar las preguntas.");
    }
    resultados.push(...data);
  }

  return resultados.map(fromRow);
};
