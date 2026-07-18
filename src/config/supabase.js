import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si faltan, la app arranca y falla en cada request con un error que no dice nada.
// Mejor reventar temprano y claro (pasa en un deploy sin las env configuradas).
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Configúralas en .env.local (dev) o en Vercel (prod)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL_DOMAIN = "mcdental.internal";

// Debe coincidir exactamente con el saneo aplicado en scripts/migrate-firestore-to-supabase.mjs
export const usernameToSyntheticEmail = (username) => {
  const saneado = (username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
  return `${saneado}@${EMAIL_DOMAIN}`;
};
