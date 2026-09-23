import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { configOk, quienLlama } from "./_auth.js";

// Proxy serverless para leer INE/CURP/RFC/comprobante con IA y prellenar un contrato. Mismo
// patrón de autenticación y cuota que api/gemini.js (JWT + rol de gestión + consumir_cuota_ia):
// es la misma cuenta de Gemini y el mismo riesgo de abuso, así que comparte guardarraíles en
// vez de reinventarlos.
const API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Límite del PAYLOAD, no del archivo: varios documentos en base64 (INE, CURP, RFC,
// comprobante) viajan juntos en un solo request. 20 MB en base64 son ~15 MB reales, de
// sobra para cuatro fotos de documentos y lejos del límite de 10 MB por archivo que ya
// impone archivosExpedienteService (esos archivos, sumados, nunca se acercan a esto salvo
// que alguien mande cuatro archivos al tope).
const MAX_BASE64_TOTAL = 20 * 1024 * 1024;
const MAX_ARCHIVOS = 4;

const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

const PROMPT_EXTRACCION = `Eres un asistente que lee documentos de identidad mexicanos (INE, CURP, constancia de
situación fiscal/RFC, comprobante de domicilio) para prellenar un contrato laboral.

Devuelve SOLO un objeto JSON (sin texto alrededor, sin markdown) con estas claves exactas.
Usa null en cualquier campo que no puedas leer con certeza — nunca inventes un dato:

{
  "nombreCompleto": string|null,
  "curp": string|null,
  "rfc": string|null,
  "fechaNacimiento": string|null,
  "sexo": "Hombre"|"Mujer"|null,
  "estadoCivil": string|null,
  "nacionalidad": string|null,
  "domicilioCalleNumero": string|null,
  "domicilioColonia": string|null,
  "domicilioCP": string|null,
  "domicilioCiudad": string|null,
  "domicilioEstado": string|null
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY no configurada en el servidor." });
  }
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no configurado en el servidor." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "No autenticado." });
  }

  // Solo gestión: es la misma pantalla (expediente) y el mismo dato sensible (RFC/CURP de
  // un tercero) que ya protege el resto de api/ con este mismo criterio.
  const quien = await quienLlama(req);
  if (!quien) {
    return res.status(401).json({ error: "Sesión inválida." });
  }
  if (!["admin", "admin_plus", "rh", "psicologa"].includes(quien.role)) {
    return res.status(403).json({ error: "No autorizado." });
  }

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

  const { archivos } = req.body || {};
  if (!Array.isArray(archivos) || archivos.length === 0) {
    return res.status(400).json({ error: "Falta 'archivos' (al menos uno)." });
  }
  if (archivos.length > MAX_ARCHIVOS) {
    return res.status(400).json({ error: `Máximo ${MAX_ARCHIVOS} documentos por extracción.` });
  }

  let tamanoTotal = 0;
  for (const a of archivos) {
    if (!a || typeof a.base64 !== "string" || typeof a.mimeType !== "string") {
      return res.status(400).json({ error: "Cada archivo necesita 'base64' y 'mimeType'." });
    }
    if (!MIME_PERMITIDOS.includes(a.mimeType)) {
      return res.status(400).json({ error: `Tipo de archivo no soportado: ${a.mimeType}.` });
    }
    tamanoTotal += a.base64.length;
  }
  if (tamanoTotal > MAX_BASE64_TOTAL) {
    return res.status(413).json({ error: "Los documentos juntos exceden el límite permitido." });
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const partesImagen = archivos.map((a) => ({
      inlineData: { data: a.base64, mimeType: a.mimeType },
    }));

    const result = await model.generateContent([...partesImagen, PROMPT_EXTRACCION]);
    const texto = result.response.text();

    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      console.error("Gemini no devolvió JSON válido:", texto);
      return res.status(502).json({ error: "La IA no devolvió un resultado interpretable. Intenta de nuevo." });
    }

    return res.status(200).json({ datos });
  } catch (error) {
    console.error("Error Gemini proxy (extraer-datos-documento):", error);
    return res.status(502).json({ error: "Error al contactar la IA." });
  }
}
