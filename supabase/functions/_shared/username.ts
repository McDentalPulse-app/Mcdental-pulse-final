const EMAIL_DOMAIN = "mcdental.internal";

// Debe coincidir exactamente con src/config/supabase.js (usernameToSyntheticEmail)
// y con scripts/migrate-firestore-to-supabase.mjs.
export const usernameToSyntheticEmail = (username: string): string => {
  const saneado = (username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
  return `${saneado}@${EMAIL_DOMAIN}`;
};

export const TEMP_PASSWORD = "emp123";
