export const callAI = async (prompt, systemPrompt = "") => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_AI_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt || "Eres el motor de IA de McDental Pulse, un sistema de bienestar organizacional para una clínica dental. Respondes siempre en español, de forma concisa, profesional y empática. Nunca diagnosticas, solo sugieres intervenciones. Tus respuestas van dirigidas a psicólogas o administradores.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  return data.content?.map(c => c.text || "").join("") || "Sin respuesta";
};
