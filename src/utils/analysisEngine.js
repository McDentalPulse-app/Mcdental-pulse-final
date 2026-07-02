import { supabase } from "../config/supabase";

// Llama al proxy serverless (/api/gemini). La key vive en el servidor, no en el bundle.
// Adjunta el JWT de la sesión: el proxy exige un usuario Supabase autenticado.
export const callAI = async (prompt) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
  }

  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al contactar la IA.");
  }

  const data = await res.json();
  return data.text || "Sin respuesta";
};
