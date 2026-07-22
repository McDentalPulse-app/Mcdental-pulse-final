import { supabase } from "../../config/supabase";

/**
 * Color de marca del usuario. Cada persona guarda SU color; null = default (teal).
 *
 * Un empleado normal no tiene UPDATE sobre `usuarios`, así que la escritura pasa
 * por la RPC `guardar_mi_color` (security definer, acotada a auth.uid()). Ver
 * migración 00000000000070_color_acento.sql — mismo patrón que mark_password_changed.
 */

const ES_HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Guarda el color del usuario autenticado.
 * @param {string|null} hex `#RRGGBB` o null para volver al color por defecto.
 */
export const guardarMiColor = async (hex) => {
  // Validación en el borde: solo hex #RRGGBB o null salen hacia la BD.
  const valor = hex == null ? null : String(hex).trim();
  if (valor !== null && !ES_HEX.test(valor)) {
    throw new Error("Color inválido: debe ser un hex #RRGGBB.");
  }

  const { error } = await supabase.rpc("guardar_mi_color", { p_color: valor });

  if (error) {
    console.error("Error al guardar el color de acento:", error);
    throw new Error("No se pudo guardar el color.");
  }
  return valor;
};
