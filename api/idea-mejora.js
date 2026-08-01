import { createClient } from "@supabase/supabase-js";

// Proxy serverless: reenvía la idea de mejora a MCTIC, donde cae en Pendientes. Misma clave
// de integración que los tickets de soporte y por el mismo motivo: vive en el servidor
// (MCTIC_INTEGRATION_KEY), nunca en el bundle del navegador.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const MCTIC_API_URL = process.env.MCTIC_API_URL;
const MCTIC_INTEGRATION_KEY = process.env.MCTIC_INTEGRATION_KEY;

// Las de MCTIC en su tablero de Pendientes: ahí no existe CRÍTICA, y con razón — una idea de
// mejora nunca es una urgencia, para eso está el ticket de soporte.
const PRIORITIES = new Set(["BAJA", "MEDIA", "ALTA"]);

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: "Supabase no configurado en el servidor." });
  }
  if (!MCTIC_API_URL || !MCTIC_INTEGRATION_KEY) {
    return res.status(500).json({ error: "Integración con MCTIC no configurada en el servidor." });
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

  // GET: las ideas de quien pregunta, para ver en qué van. El correo sale del JWT verificado,
  // así que nadie puede pedir las ideas de otra persona.
  if (req.method === "GET") {
    try {
      const resp = await fetch(
        `${MCTIC_API_URL}/api/v1/integrations/ideas?requester=${encodeURIComponent(user.email)}`,
        { headers: { "X-Integration-Key": MCTIC_INTEGRATION_KEY } },
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return res.status(502).json({ error: "No se pudieron consultar tus ideas." });
      }
      return res.status(200).json({ ideas: data?.data ?? [] });
    } catch {
      return res.status(502).json({ error: "No se pudo contactar al sistema de TI." });
    }
  }

  const { title, description, priority, name } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "El título es obligatorio." });
  }

  const prio = PRIORITIES.has(priority) ? priority : "MEDIA";
  // Identidad de confianza: el correo proviene del JWT verificado, no del cliente.
  const displayName = name && String(name).trim();
  const requester = displayName ? `${displayName} (${user.email})` : user.email;

  try {
    const resp = await fetch(`${MCTIC_API_URL}/api/v1/integrations/ideas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Integration-Key": MCTIC_INTEGRATION_KEY,
      },
      body: JSON.stringify({
        title: String(title).trim().slice(0, 200),
        description: description ? String(description).trim() : "",
        priority: prio,
        requester,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(502).json({ error: "No se pudo registrar la idea en MCTIC." });
    }
    return res.status(201).json({ id: data?.data?.id, status: data?.data?.status });
  } catch {
    return res.status(502).json({ error: "No se pudo contactar al sistema de TI." });
  }
}
