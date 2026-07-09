import { createClient } from "@supabase/supabase-js";

// Proxy serverless: reenvía la solicitud de soporte a MCTIC. La clave de integración
// vive en el servidor (MCTIC_INTEGRATION_KEY), nunca en el bundle del navegador.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const MCTIC_API_URL = process.env.MCTIC_API_URL; // p. ej. https://mctic.tu-dominio.com
const MCTIC_INTEGRATION_KEY = process.env.MCTIC_INTEGRATION_KEY;

const CATEGORIES = new Set(["HARDWARE", "SOFTWARE", "RED", "CUENTAS", "OTRO"]);
const PRIORITIES = new Set(["BAJA", "MEDIA", "ALTA", "CRITICA"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: "Supabase no configurado en el servidor." });
  }
  if (!MCTIC_API_URL || !MCTIC_INTEGRATION_KEY) {
    return res.status(500).json({ error: "Integración con soporte no configurada en el servidor." });
  }

  // Solo usuarios autenticados: se valida el JWT de Supabase del caller.
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

  const { subject, description, category, priority, name } = req.body || {};
  if (!subject || !String(subject).trim()) {
    return res.status(400).json({ error: "El asunto es obligatorio." });
  }

  const cat = CATEGORIES.has(category) ? category : "OTRO";
  const prio = PRIORITIES.has(priority) ? priority : "MEDIA";
  // Identidad de confianza: el correo proviene del JWT verificado, no del cliente.
  const displayName = name && String(name).trim();
  const requester = displayName ? `${displayName} (${user.email})` : user.email;

  try {
    const resp = await fetch(`${MCTIC_API_URL}/api/v1/integrations/helpdesk/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Integration-Key": MCTIC_INTEGRATION_KEY,
      },
      body: JSON.stringify({
        subject: String(subject).trim().slice(0, 200),
        description: description ? String(description).trim() : "",
        category: cat,
        priority: prio,
        requester,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(502).json({ error: "No se pudo registrar el ticket en soporte." });
    }
    return res.status(201).json({ id: data?.data?.id, status: data?.data?.status });
  } catch (err) {
    return res.status(502).json({ error: "No se pudo contactar al sistema de soporte." });
  }
}
