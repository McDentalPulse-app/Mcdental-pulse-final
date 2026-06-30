import { GoogleGenerativeAI } from "@google/generative-ai";

// Proxy serverless: la key vive en el servidor (GEMINI_API_KEY), nunca en el bundle.
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_SYSTEM =
  "Eres el motor de IA de McDental Pulse, un sistema de bienestar organizacional para una clínica dental. " +
  "Respondes siempre en español, de forma concisa, profesional y empática. " +
  "Nunca diagnosticas, solo sugieres intervenciones. " +
  "Tus respuestas van dirigidas a psicólogas o administradores.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY no configurada en el servidor." });
  }

  const { prompt, system } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Falta 'prompt'." });
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: system || DEFAULT_SYSTEM,
    });
    const result = await model.generateContent(prompt);
    return res.status(200).json({ text: result.response.text() });
  } catch (error) {
    console.error("Error Gemini proxy:", error);
    return res.status(502).json({ error: "Error al contactar la IA." });
  }
}
