import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const SYSTEM_PROMPT =
  "Eres el motor de IA de McDental Pulse, un sistema de bienestar organizacional para una clínica dental. " +
  "Respondes siempre en español, de forma concisa, profesional y empática. " +
  "Nunca diagnosticas, solo sugieres intervenciones. " +
  "Tus respuestas van dirigidas a psicólogas o administradores.";

export const callAI = async (prompt) => {
  if (!genAI) {
    throw new Error("No se ha configurado VITE_GEMINI_API_KEY.");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
};
