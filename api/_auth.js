import { createClient } from "@supabase/supabase-js";

/**
 * Autenticación de las funciones serverless que tocan rostros.
 *
 * Dos clientes de Supabase, y la diferencia entre ellos es la seguridad entera de este
 * módulo:
 *
 *   - El de la ANON KEY sirve solo para VERIFICAR el JWT de quien llama y averiguar quién
 *     es. No puede saltarse RLS.
 *   - El de la SERVICE ROLE se salta RLS y es el que escribe las huellas y los resultados
 *     del cotejo. Nunca sale del servidor. Si esa clave llegara al navegador, cualquiera
 *     podría ponerse un match_score de 1.0 y el cotejo valdría cero.
 *
 * Por eso las tablas `rostros` y `asistencias` no tienen policy de escritura para el
 * cliente: el único camino es este, y este exige la service role.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const configOk = () => !!(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

/** Cliente con permisos totales. Solo servidor. */
export const admin = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * Quién llama. Devuelve la fila de `usuarios` (con su rol) o null si el token no vale.
 *
 * El rol se lee de la BASE DE DATOS, no del JWT: un token puede llevar los claims que sea,
 * pero `usuarios.role` es la verdad. Confiar en un rol que viene del cliente sería regalar
 * el enrolado a cualquiera que sepa editar un token.
 */
export const quienLlama = async (req) => {
  const cabecera = req.headers.authorization || "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  if (!token) return null;

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return null;

  const { data: perfil } = await admin()
    .from("usuarios")
    .select("id, name, role, inactivo")
    .eq("auth_user_id", user.id)
    .single();

  if (!perfil || perfil.inactivo) return null;
  return perfil;
};
