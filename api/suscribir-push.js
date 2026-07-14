import { configOk, admin, quienLlama } from "./_auth.js";

/**
 * Guarda (o quita) la suscripción push de quien llama.
 *
 * El endpoint existe porque la fila lleva el `empleado_id`, y ese NO se puede confiar al cliente:
 * si el navegador mandara "suscribe a este empleado", cualquiera suscribiría el teléfono de otro
 * para inundarlo de avisos. Aquí el empleado sale del JWT ya verificado — el cliente solo aporta
 * los datos de SU propio navegador (el endpoint y las claves que este generó).
 *
 * Se guarda con upsert por `endpoint`: el mismo teléfono, si renueva su suscripción (el navegador
 * lo hace solo de tanto en tanto), ACTUALIZA su fila en vez de crear una segunda. Sin eso, el
 * mismo aviso acabaría enviándose varias veces al mismo aparato.
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  const quien = await quienLlama(req);
  if (!quien) {
    return res.status(401).json({ error: "Sesión inválida." });
  }

  const supabase = admin();
  const { suscripcion } = req.body || {};

  // Darse de baja: se borra por endpoint, pero SOLO si es suyo. Sin el filtro por empleado_id, un
  // endpoint filtrado permitiría borrar la suscripción de otra persona (molestia, no fuga, pero
  // molestia gratis).
  if (req.method === "DELETE") {
    if (suscripcion?.endpoint) {
      await supabase
        .from("push_suscripciones")
        .delete()
        .eq("endpoint", suscripcion.endpoint)
        .eq("empleado_id", quien.id);
    }
    return res.status(200).json({ ok: true });
  }

  const endpoint = suscripcion?.endpoint;
  const p256dh = suscripcion?.keys?.p256dh;
  const auth = suscripcion?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "Suscripción incompleta." });
  }

  const { error } = await supabase
    .from("push_suscripciones")
    .upsert(
      {
        empleado_id: quien.id,
        endpoint,
        p256dh,
        auth,
        user_agent: (req.headers["user-agent"] || "").slice(0, 300),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("Error guardando la suscripción push:", error);
    return res.status(500).json({ error: "No se pudo guardar la suscripción." });
  }

  return res.status(200).json({ ok: true });
}
