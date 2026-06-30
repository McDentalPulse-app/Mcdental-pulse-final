// Llama al proxy serverless (/api/gemini). La key vive en el servidor, no en el bundle.
export const callAI = async (prompt, systemPrompt = "") => {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, system: systemPrompt || undefined }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al contactar la IA.");
  }

  const data = await res.json();
  return data.text || "Sin respuesta";
};
