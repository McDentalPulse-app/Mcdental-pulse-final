import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
