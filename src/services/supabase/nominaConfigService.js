import { supabase } from "../../config/supabase";

/**
 * Los montos fijos que se descuentan por retardo y por falta. Una sola fila (migración 156).
 *
 * Solo la leen y la escriben admin, rh y psicologa: lo garantiza la RLS, no este archivo.
 */

const SELECT_CONFIG = "monto_retardo, monto_falta, actualizado_en";

const mapConfig = (row) => ({
  montoRetardo: Number(row?.monto_retardo ?? 0),
  montoFalta: Number(row?.monto_falta ?? 0),
  actualizadoEn: row?.actualizado_en || null,
});

/**
 * Ante un fallo de red, se devuelven ceros en vez de propagar el error.
 *
 * Es deliberado y va en la dirección segura: con montos en cero la pantalla enseña la semana
 * SIN descuentos, que es visiblemente raro y se nota enseguida. Lo contrario —que un fallo de
 * lectura dejara montos a medias— sí produciría un pago final equivocado con pinta de correcto.
 */
export const getNominaConfig = async () => {
  const { data, error } = await supabase.from("nomina_config").select(SELECT_CONFIG).maybeSingle();

  if (error) {
    console.error("Error al obtener la configuración de nómina:", error);
    return { montoRetardo: 0, montoFalta: 0, actualizadoEn: null };
  }
  return mapConfig(data);
};

/** Guarda los dos montos. Los valida antes de mandarlos para dar un mensaje claro en vez de un error de Postgres. */
export const setNominaConfig = async ({ montoRetardo, montoFalta }, usuarioId) => {
  const limpio = (v, nombre) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`El monto ${nombre} debe ser un número de 0 o más.`);
    // Dos decimales: la columna es numeric(10,2) y Postgres redondearía por su cuenta, así que
    // se redondea aquí para que lo que se guarda sea exactamente lo que se vio al escribirlo.
    return Math.round(n * 100) / 100;
  };

  const payload = {
    monto_retardo: limpio(montoRetardo, "por retardo"),
    monto_falta: limpio(montoFalta, "por falta"),
    actualizado_en: new Date().toISOString(),
    actualizado_por: usuarioId || null,
  };

  const { data, error } = await supabase
    .from("nomina_config")
    .update(payload)
    .eq("id", true)
    .select(SELECT_CONFIG)
    .single();

  if (error) {
    console.error("Error al guardar la configuración de nómina:", error);
    throw new Error("No se pudieron guardar los montos.");
  }
  return mapConfig(data);
};
