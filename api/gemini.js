import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Proxy serverless: la key vive en el servidor (GEMINI_API_KEY), nunca en el bundle.
const API_KEY = process.env.GEMINI_API_KEY;

// Cliente Supabase con anon key: solo se usa para validar el JWT del caller
// (auth.getUser verifica el token contra el servidor de auth). No bypasea RLS.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

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
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: "Supabase no configurado en el servidor." });
  }

  // Autenticación: exige un JWT de Supabase válido. Sin esto, el endpoint quedaba
  // público (cualquiera con la URL podía quemar la cuota de Gemini y override del prompt).
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "No autenticado." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Sesión inválida." });
  }

  // Rate limiting (migración 033). Sin esto, un usuario autenticado podía llamar a la IA
  // en bucle y quemar la cuota de Gemini. Esta función corre en serverless y no tiene
  // memoria entre invocaciones, así que el contador vive en la base: la RPC comprueba y
  // registra en la misma transacción, y es security definer — el cliente no puede tocar
  // el contador ni borrarlo para saltarse el límite.
  const supabaseUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: cuota, error: cuotaError } = await supabaseUsuario.rpc("consumir_cuota_ia");

  if (cuotaError) {
    console.error("Error comprobando la cuota de IA:", cuotaError);
    return res.status(500).json({ error: "No se pudo verificar tu cuota de IA." });
  }

  const permiso = Array.isArray(cuota) ? cuota[0] : cuota;
  if (!permiso?.permitido) {
    return res.status(429).json({
      error: `Has alcanzado el límite de ${permiso?.limite ?? 30} consultas a la IA por hora. Inténtalo de nuevo más tarde.`,
    });
  }

  // Se ignora cualquier 'system' del cliente: el system prompt lo fija el servidor
  // para que no se pueda sobreescribir el guardarraíl "nunca diagnostiques".
  const { prompt } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Falta 'prompt'." });
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: DEFAULT_SYSTEM,
    });
    const result = await model.generateContent(prompt);
    return res.status(200).json({ text: result.response.text() });
  } catch (error) {
    console.error("Error Gemini proxy:", error);
    return res.status(502).json({ error: "Error al contactar la IA." });
  }
}
