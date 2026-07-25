import { supabase } from "../../config/supabase";

/**
 * Ajustes globales. Una sola fila (migración 044).
 *
 * `exigirRostro`: si está encendido, sin rostro aprobado no se puede checar. Nace apagado a
 * propósito — encenderlo el primer día dejaría a toda la plantilla sin poder fichar, porque
 * nadie estaría registrado todavía.
 *
 * `avisosSegundos` (migración 084): la espera mínima antes de que el botón "De acuerdo" del
 * modal de avisos se pueda pulsar. Antes eran 30 segundos clavados en el código, así que
 * cambiarlos exigía recompilar y redesplegar.
 */

export const AVISOS_SEGUNDOS_DEFECTO = 30;
export const AVISOS_SEGUNDOS_MAX = 300;

const SELECT_AJUSTES = "exigir_rostro, avisos_segundos, actualizado_en";

const mapAjustes = (row) => ({
  exigirRostro: !!row?.exigir_rostro,
  avisosSegundos: row?.avisos_segundos ?? AVISOS_SEGUNDOS_DEFECTO,
  actualizadoEn: row?.actualizado_en,
});

export const getAjustes = async () => {
  const { data, error } = await supabase.from("ajustes").select(SELECT_AJUSTES).maybeSingle();

  if (error) {
    console.error("Error al obtener los ajustes:", error);
    // Ante la duda, NO se exige rostro: un fallo de red no puede dejar a nadie sin fichar.
    // El servidor tiene la última palabra de todos modos. La espera del aviso cae al valor
    // de fábrica: es un mínimo de lectura, no un permiso.
    return { exigirRostro: false, avisosSegundos: AVISOS_SEGUNDOS_DEFECTO };
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
    .select(SELECT_AJUSTES)
    .single();

  if (error) {
    console.error("Error al guardar el ajuste:", error);
    throw new Error("No se pudo guardar el ajuste.");
  }
  return mapAjustes(data);
};

/**
 * Solo admin (RLS). El rango lo valida también la base (ajustes_avisos_segundos_rango):
 * acá se recorta antes de mandarlo para dar un mensaje claro en vez de un error de Postgres.
 */
export const setAvisosSegundos = async (segundos, adminId) => {
  const valor = Math.round(Number(segundos));
  if (!Number.isFinite(valor) || valor < 0 || valor > AVISOS_SEGUNDOS_MAX) {
    throw new Error(`La espera debe ser un número entre 0 y ${AVISOS_SEGUNDOS_MAX} segundos.`);
  }

  const { data, error } = await supabase
    .from("ajustes")
    .update({
      avisos_segundos: valor,
      actualizado_en: new Date().toISOString(),
      actualizado_por: adminId || null,
    })
    .eq("id", true)
    .select(SELECT_AJUSTES)
    .single();

  if (error) {
    console.error("Error al guardar la espera de avisos:", error);
    throw new Error("No se pudo guardar el tiempo de espera.");
  }
  return mapAjustes(data);
};
