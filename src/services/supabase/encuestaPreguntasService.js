import { supabase } from "../../config/supabase";
import { preguntaToRow } from "../../utils/encuestaPreguntas";

const toRow = (p) => {
  const base = preguntaToRow(p);
  return {
    texto: base.texto,
    tipo: base.tipo,
    area: base.area,
    opciones: base.opciones,
    orden: base.orden,
    activa: base.activa,
    bloque_id: base.bloque_id,
    peso: base.peso,
    invertida: base.invertida,
  };
};

const fromRow = (row) => ({
  id: row.id,
  texto: row.texto,
  tipo: row.tipo,
  area: row.area,
  opciones: row.opciones,
  orden: row.orden,
  activa: row.activa,
  bloqueId: row.bloque_id ?? null,
  peso: row.peso ?? 1,
  invertida: row.invertida === true,
  // Clave con la que las encuestas migradas de Firestore guardaron la respuesta. Se lee,
  // pero NO se manda de vuelta en preguntaToRow: la asigna la base y es única.
  legacyId: row.legacy_id ?? null,
});

// Actualiza las preguntas que ya tienen id (uuid real), crea las que no lo tienen, y borra
// las que `idsAEliminar` señale.
export const saveEncuestaPreguntas = async (preguntas, idsAEliminar = []) => {
  // Los borrados van PRIMERO: si la base rechaza alguno —el trigger de la migración 159 no
  // deja borrar una pregunta que alguien ya contestó— se corta aquí, antes de haber escrito
  // nada. Al revés quedarían las ediciones aplicadas y el borrado sin hacer, que es el
  // estado más difícil de entender para quien está delante.
  if (idsAEliminar.length) {
    const { error } = await supabase
      .from("encuesta_preguntas")
      .delete()
      .in("id", idsAEliminar);

    if (error) {
      console.error("Error al eliminar preguntas de encuesta:", error);
      throw new Error(error.message || "No se pudieron eliminar las preguntas.");
    }

    // Se comprueba que las filas YA NO ESTÁN, en vez de contar las que devolvió el delete.
    // Contarlas rompía el reintento: si el guardado fallaba DESPUÉS del borrado —un corte
    // de red en el upsert—, al volver a pulsar Guardar el delete afectaba 0 filas (ya no
    // existían) y la app respondía "no tienes permiso", que es falso, en bucle y sin salida.
    // Preguntar si queda alguna es idempotente: si el borrado ocurrió, no queda ninguna,
    // se reintente las veces que se reintente.
    const { data: quedan, error: errorVerificacion } = await supabase
      .from("encuesta_preguntas")
      .select("id")
      .in("id", idsAEliminar);

    if (errorVerificacion) {
      console.error("Error al verificar el borrado de preguntas:", errorVerificacion);
      throw new Error("No se pudo confirmar que las preguntas se borraran.");
    }
    // Siguen ahí: el delete no llegó a la base. RLS no da error, simplemente no afecta
    // nada, y la app cantaría un borrado que no ocurrió.
    if (quedan.length) {
      throw new Error("No tienes permiso para eliminar preguntas de la encuesta.");
    }
  }

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


/**
 * Banco de bloques rotatorios: crear, renombrar, reordenar y activar/desactivar.
 *
 * Qué bloque toca cada quincena no se guarda en ningún sitio: se deriva de la semana en
 * bloqueDeLaSemana() (utils/encuestaBloques.js). Aquí solo se administra el banco.
 */
export const crearBloque = async ({ nombre, descripcion = null, orden = 0 }) => {
  const limpio = String(nombre || "").trim();
  if (!limpio) throw new Error("Escribe el nombre del bloque.");

  const { data, error } = await supabase
    .from("encuesta_bloques")
    .insert({ nombre: limpio, descripcion, orden })
    .select()
    .single();

  if (error) {
    // 23505 = el índice único sobre lower(nombre). Mensaje claro en vez del error de Postgres.
    if (error.code === "23505") throw new Error("Ya existe un bloque con ese nombre.");
    console.error("Error creando el bloque:", error);
    throw new Error("No se pudo crear el bloque.");
  }
  return data;
};

export const actualizarBloque = async (id, cambios) => {
  const payload = {};
  if (cambios.nombre !== undefined) payload.nombre = String(cambios.nombre).trim();
  if (cambios.descripcion !== undefined) payload.descripcion = cambios.descripcion;
  if (cambios.orden !== undefined) payload.orden = cambios.orden;
  if (cambios.activo !== undefined) payload.activo = cambios.activo;

  const { data, error } = await supabase
    .from("encuesta_bloques")
    .update(payload)
    .eq("id", id)
    .select();

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un bloque con ese nombre.");
    console.error("Error actualizando el bloque:", error);
    throw new Error("No se pudo actualizar el bloque.");
  }
  // Sin filas devueltas, el update no llegó a la base: RLS no da error, simplemente no
  // afecta nada, y la app cantaría un guardado que no ocurrió.
  if (!data?.length) throw new Error("No tienes permiso para editar los bloques.");
  return data[0];
};

export const eliminarBloque = async (id) => {
  const { data, error } = await supabase
    .from("encuesta_bloques")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    // 23503 = la FK de encuesta_preguntas: el bloque todavía tiene preguntas dentro. No se
    // borran en cascada a propósito: quedarían con bloque_id null, o sea que pasarían a ser
    // del núcleo y entrarían al Pulse Score sin que nadie lo pidiera.
    if (error.code === "23503") {
      throw new Error("Este bloque todavía tiene preguntas. Muévelas o bórralas primero.");
    }
    console.error("Error eliminando el bloque:", error);
    throw new Error("No se pudo eliminar el bloque.");
  }
  if (!data?.length) throw new Error("No tienes permiso para eliminar los bloques.");
};
