import { supabase } from "../../config/supabase";

/**
 * El estado ACTUAL del sistema, para la pantalla de Configuración.
 *
 * Toda la lógica vive en la función SQL `estado_del_sistema()` (migración 109) y no aquí: la
 * misma verdad la consultan esta pantalla y la tarea de fondo que avisa. Si cada una calculara
 * lo suyo acabarían discrepando, y nadie sabría a cuál creer.
 *
 * La función rechaza a quien no sea admin, RH o psicóloga. Ese "No autorizado." se deja pasar
 * como error normal: la pantalla solo existe para esos roles.
 */
export const getEstadoDelSistema = async () => {
  const { data, error } = await supabase.rpc("estado_del_sistema");
  if (error) {
    console.error("Error consultando el estado del sistema:", error);
    throw new Error("No se pudo consultar el estado del sistema.");
  }
  return (data || []).map((f) => ({
    clave: f.clave,
    titulo: f.titulo,
    estado: f.estado,
    detalle: f.detalle,
    valor: f.valor === null ? null : Number(f.valor),
  }));
};
