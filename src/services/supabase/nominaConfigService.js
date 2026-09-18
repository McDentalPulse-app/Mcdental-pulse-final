import { supabase } from "../../config/supabase";

/**
 * El monto fijo que se descuenta por retardo. Una sola fila (migración 156).
 *
 * `monto_falta` sigue existiendo en la tabla pero ya no se lee ni se escribe aquí (decisión
 * del dueño, 2026-09-19): la falta dejó de ser un monto fijo y pasó a ser el sueldo diario de
 * cada quien (sueldoSemanal/7, ver utils/nomina.js) — no hay nada que configurar para eso.
 *
 * Solo la leen y la escriben admin, rh y psicologa: lo garantiza la RLS, no este archivo.
 */

const SELECT_CONFIG = "monto_retardo, actualizado_en";

const mapConfig = (row) => ({
  montoRetardo: Number(row?.monto_retardo ?? 0),
  actualizadoEn: row?.actualizado_en || null,
});

/**
 * Ante un fallo de red, se devuelve cero en vez de propagar el error.
 *
 * Es deliberado y va en la dirección segura: con el monto en cero la pantalla enseña la semana
 * SIN descuento de retardos, que es visiblemente raro y se nota enseguida. Lo contrario —que un
 * fallo de lectura dejara un monto a medias— sí produciría un pago final equivocado con pinta
 * de correcto.
 */
export const getNominaConfig = async () => {
  const { data, error } = await supabase.from("nomina_config").select(SELECT_CONFIG).maybeSingle();

  if (error) {
    console.error("Error al obtener la configuración de nómina:", error);
    return { montoRetardo: 0, actualizadoEn: null };
  }
  return mapConfig(data);
};

/** Guarda el monto por retardo. Lo valida antes de mandarlo para dar un mensaje claro en vez de un error de Postgres. */
export const setNominaConfig = async ({ montoRetardo }, usuarioId) => {
  const n = Number(montoRetardo);
  if (!Number.isFinite(n) || n < 0) throw new Error("El monto por retardo debe ser un número de 0 o más.");

  const payload = {
    // Dos decimales: la columna es numeric(10,2) y Postgres redondearía por su cuenta, así que
    // se redondea aquí para que lo que se guarda sea exactamente lo que se vio al escribirlo.
    monto_retardo: Math.round(n * 100) / 100,
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
    throw new Error("No se pudo guardar el monto.");
  }
  return mapConfig(data);
};
