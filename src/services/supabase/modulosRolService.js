import { supabase } from "../../config/supabase";

// Interruptor GLOBAL por rol (mig. 147) — aparte del interruptor por persona que ya
// vive en usuariosService.js. Tabla chica (rol × ítem de navItems.js), cabe entera en
// memoria: se carga una vez en GlobalContext, igual que getSucursales().
//
// Forma en memoria: { admin: { usuarios: true, inventario: false, ... }, doctor: {...} }.
// Un rol/ítem AUSENTE del mapa cuenta como prendido (default true en la base).
export const getModulosRol = async () => {
  const { data, error } = await supabase.from("modulos_rol").select("role, item_key, activo");
  if (error) {
    console.error("Error al obtener módulos por rol:", error);
    throw new Error("No se pudieron cargar los módulos por rol.", { cause: error });
  }
  const mapa = {};
  for (const fila of data || []) {
    if (!mapa[fila.role]) mapa[fila.role] = {};
    mapa[fila.role][fila.item_key] = fila.activo;
  }
  return mapa;
};

// Admin+ (RLS lo exige) prende/apaga un ítem para TODO el rol de una.
export const setModuloRol = async (role, itemKey, activo) => {
  const { error } = await supabase
    .from("modulos_rol")
    .upsert({ role, item_key: itemKey, activo }, { onConflict: "role,item_key" });
  if (error) {
    console.error("Error al guardar el módulo por rol:", error);
    throw new Error("No se pudo guardar el cambio.", { cause: error });
  }
};
