import { supabase } from "../../config/supabase";

// Interruptor por PERSONA para cualquier ítem del menú (mig. 150) — aparte de los 6 con
// columna dedicada (comisiones/checador/notas/departamentos/avisos/encuestas, que siguen
// usando usuariosService.js sin cambios) y aparte del interruptor global por rol
// (modulosRolService.js). Un ítem AUSENTE cuenta como prendido (default true en la base).

// Cada quien pide SUS propias filas al iniciar sesión — RLS ya las acota a eso.
export const getMisModulosPersona = async (usuarioId) => {
  const { data, error } = await supabase
    .from("modulos_persona")
    .select("item_key, activo")
    .eq("usuario_id", usuarioId);
  if (error) {
    console.error("Error al obtener mis módulos:", error);
    throw new Error("No se pudieron cargar tus módulos.", { cause: error });
  }
  const mapa = {};
  for (const fila of data || []) mapa[fila.item_key] = fila.activo;
  return mapa;
};

// Admin+ pide las de una persona en particular, para la pantalla de gestión.
export const getModulosPersonaDe = async (usuarioId) => {
  const { data, error } = await supabase
    .from("modulos_persona")
    .select("item_key, activo")
    .eq("usuario_id", usuarioId);
  if (error) {
    console.error("Error al obtener los módulos de la persona:", error);
    throw new Error("No se pudieron cargar sus módulos.", { cause: error });
  }
  const mapa = {};
  for (const fila of data || []) mapa[fila.item_key] = fila.activo;
  return mapa;
};

// Admin+ prende/apaga un ítem para ESA persona.
export const setModuloPersona = async (usuarioId, itemKey, activo) => {
  const { error } = await supabase
    .from("modulos_persona")
    .upsert({ usuario_id: usuarioId, item_key: itemKey, activo }, { onConflict: "usuario_id,item_key" });
  if (error) {
    console.error("Error al guardar el módulo de la persona:", error);
    throw new Error("No se pudo guardar el cambio.", { cause: error });
  }
};
