import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

/**
 * Los números del cotejo facial, en crudo, para la pantalla de calibración.
 *
 * Se piden SOLO los scores, sin fotos, sin huellas y sin ubicaciones: para decidir dónde va el
 * umbral hacen falta números, no las caras de la plantilla. Traer de más "porque está ahí" es
 * exponer datos biométricos sin motivo.
 */

/** Los scores de las checadas que SÍ pasaron el cotejo (la nube de arriba). */
export const getScoresChecadas = async ({ desde } = {}) => {
  try {
    const rows = await fetchAll(() => {
      let q = supabase
        .from("asistencias")
        .select("empleado_id, match_score, marcada_en")
        .not("match_score", "is", null);
      if (desde) q = q.gte("fecha", desde);
      return q.order("marcada_en", { ascending: false });
    });
    return rows;
  } catch (error) {
    console.error("Error al obtener los scores de las checadas:", error);
    throw new Error("No se pudieron cargar los datos del cotejo.", { cause: error });
  }
};

/**
 * Los scores de los intentos que NO pasaron (la nube de abajo).
 *
 * Solo hay 30 días: los intentos se purgan (migración 046). No es una pérdida — un rechazo de
 * hace tres meses no dice nada de si el umbral de hoy está bien puesto.
 *
 * Requiere el GRANT que la migración 043 se dejó olvidado: tenía la policy de RLS para admin y
 * RH, pero no el `grant select` a `authenticated`, así que la policy no llegaba a ejecutarse
 * nunca y esta consulta habría devuelto cero filas sin un solo error. Se arregla en la 047.
 */
export const getIntentosFallidos = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase
        .from("cotejo_intentos")
        .select("empleado_id, score, creado_en")
        .order("creado_en", { ascending: false })
    );
    return rows;
  } catch (error) {
    console.error("Error al obtener los intentos fallidos:", error);
    throw new Error("No se pudieron cargar los intentos rechazados.", { cause: error });
  }
};

/** Los parecidos anotados al aprobar cada rostro (quién se parece demasiado a quién). */
export const getParecidos = async () => {
  const { data, error } = await supabase
    .from("rostros")
    .select("empleado_id, parecido_maximo, parecido_con")
    .eq("estado", "aprobado")
    .not("parecido_maximo", "is", null);

  if (error) {
    console.error("Error al obtener los parecidos:", error);
    throw new Error("No se pudieron cargar los parecidos entre rostros.", { cause: error });
  }
  return data || [];
};
