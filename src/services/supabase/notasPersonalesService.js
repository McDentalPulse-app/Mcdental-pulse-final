import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const mapNota = (row) => ({
  id: row.id,
  titulo: row.titulo,
  cuerpo: row.cuerpo,
  carpeta: row.carpeta,
  tags: row.tags || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getNotas = async () => {
  const rows = await fetchAll(() =>
    supabase.from("notas").select("*").order("updated_at", { ascending: false })
  );
  return rows.map(mapNota);
};

export const addNota = async ({ titulo, cuerpo = "", carpeta = null, tags = [] }) => {
  const { data, error } = await supabase
    .from("notas")
    .insert({ titulo, cuerpo, carpeta, tags })
    .select("*")
    .single();
  if (error) {
    console.error("Error creando nota:", error);
    throw new Error(
      error.code === "23505" ? "Ya tienes una nota con ese título." : "No se pudo crear la nota."
    );
  }
  return mapNota(data);
};

export const updateNota = async ({ id, titulo, cuerpo, carpeta, tags }) => {
  const { data, error } = await supabase
    .from("notas")
    .update({ titulo, cuerpo, carpeta, tags })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("Error actualizando nota:", error);
    throw new Error(
      error.code === "23505" ? "Ya tienes una nota con ese título." : "No se pudo guardar la nota."
    );
  }
  return mapNota(data);
};

export const deleteNota = async (id) => {
  const { error } = await supabase.from("notas").delete().eq("id", id);
  if (error) {
    console.error("Error eliminando nota:", error);
    throw new Error("No se pudo eliminar la nota.");
  }
};

// Saca los títulos [[Entre corchetes dobles]] del markdown de la nota (texto plano, ya
// no hace falta despojar etiquetas: el cuerpo se escribe a mano, no lo genera un editor).
export const extraerWikilinks = (markdown) => {
  const vistos = new Set();
  for (const m of (markdown || "").matchAll(/\[\[([^[\]]+)\]\]/g)) {
    const titulo = m[1].trim();
    if (titulo) vistos.add(titulo);
  }
  return [...vistos];
};

// Reemplaza los links salientes de una nota por los que tiene ahora. No es una
// transacción (no hay RPC para esto todavía) pero no es dato crítico: en el peor
// caso una carrera deja un link viejo colgando hasta el siguiente guardado.
export const guardarLinks = async (notaId, titulos, usuarioId) => {
  await supabase.from("nota_links").delete().eq("origen_id", notaId);
  if (!titulos.length) return;
  const filas = titulos.map((titulo_destino) => ({ origen_id: notaId, titulo_destino, usuario_id: usuarioId }));
  const { error } = await supabase.from("nota_links").insert(filas);
  if (error) console.error("Error guardando enlaces de la nota:", error);
};

// Notas que enlazan HACIA `titulo` (backlinks), del propio usuario (RLS ya lo acota).
export const getBacklinks = async (titulo) => {
  if (!titulo) return [];
  const { data, error } = await supabase
    .from("nota_links")
    .select("origen_id, notas!nota_links_origen_id_fkey(id, titulo)")
    .ilike("titulo_destino", titulo);
  if (error) {
    console.error("Error obteniendo backlinks:", error);
    return [];
  }
  return (data || []).map((r) => r.notas).filter(Boolean);
};
