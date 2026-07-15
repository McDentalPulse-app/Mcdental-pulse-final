import { supabase } from "../../config/supabase";

/**
 * Ajustes globales. Una sola fila (migración 044).
 *
 * De momento solo `exigirRostro`: si está encendido, sin rostro aprobado no se puede checar.
 * Nace apagado a propósito — encenderlo el primer día dejaría a toda la plantilla sin poder
 * fichar, porque nadie estaría registrado todavía.
 */

const mapAjustes = (row) => ({
  exigirRostro: !!row?.exigir_rostro,
  actualizadoEn: row?.actualizado_en,
});

export const getAjustes = async () => {
  const { data, error } = await supabase
    .from("ajustes")
    .select("exigir_rostro, actualizado_en")
    .maybeSingle();

  if (error) {
    console.error("Error al obtener los ajustes:", error);
    // Ante la duda, NO se exige rostro: un fallo de red no puede dejar a nadie sin fichar.
    // El servidor tiene la última palabra de todos modos.
    return { exigirRostro: false };
  }
  return mapAjustes(data);
};

/** Solo admin (RLS). Encender esto deja sin checar a quien no esté registrado. */
export const setExigirRostro = async (exigir, adminId) => {
  const { data, error } = await supabase
    .from("ajustes")
    .update({
      exigir_rostro: exigir,
      actualizado_en: new Date().toISOString(),
      actualizado_por: adminId || null,
    })
    .eq("id", true)
    .select("exigir_rostro, actualizado_en")
    .single();

  if (error) {
    console.error("Error al guardar el ajuste:", error);
    throw new Error("No se pudo guardar el ajuste.");
  }
  return mapAjustes(data);
};
