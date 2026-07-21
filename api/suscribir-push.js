import { configOk, admin, quienLlama } from "./_auth.js";
import { enviar, pushDisponible } from "./_push.js";

/** Mismo hash corto (djb2) que src/services/pushService.js, para comparar claves VAPID sin
 * exponer la clave entera. Debe dar el MISMO resultado que el cliente o el diagnóstico miente. */
const huellaClave = (clave) => {
  let h = 5381;
  for (let i = 0; i < clave.length; i += 1) h = ((h << 5) + h + clave.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

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

  // Rotación desde el service worker (evento pushsubscriptionchange), SIN JWT: el navegador
  // rota la suscripción por su cuenta y el SW no tiene sesión de Supabase. Se MUEVE la fila
  // existente del endpoint viejo al nuevo. Es seguro sin autenticar porque el endpoint viejo es
  // un secreto inadivinable (prueba de que es el mismo aparato) y solo se ACTUALIZA una fila que
  // ya existía — nunca se crea una para un tercero. Sin esto, cuando el navegador rota la
  // suscripción, la vieja muere y nada crea la nueva: el aparato queda mudo para siempre.
  if (req.method === "POST" && req.body?.accion === "rotar") {
    const { endpointViejo, suscripcion } = req.body || {};
    const endpoint = suscripcion?.endpoint;
    const p256dh = suscripcion?.keys?.p256dh;
    const auth = suscripcion?.keys?.auth;
    if (!endpointViejo || !endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: "Datos de rotación incompletos." });
    }
    const { data, error } = await admin()
      .from("push_suscripciones")
      .update({ endpoint, p256dh, auth })
      .eq("endpoint", endpointViejo)
      .select("id");
    if (error) {
      console.error("Error rotando la suscripción push:", error);
      return res.status(500).json({ error: "No se pudo rotar la suscripción." });
    }
    // Sin fila que mover (endpoint viejo desconocido): no es un error, solo no había nada.
    return res.status(200).json({ ok: true, rotadas: data?.length || 0 });
  }

  const quien = await quienLlama(req);
  if (!quien) {
    return res.status(401).json({ error: "Sesión inválida." });
  }

  const supabase = admin();

  // Diagnóstico: ¿el servidor tiene el push configurado y con qué clave pública? Devuelve la
  // huella de la clave del servidor para compararla contra la del bundle del cliente. Si no
  // coinciden, ahí está la avería: firman con claves distintas y el push falla en silencio.
  if (req.method === "POST" && req.body?.accion === "diagnostico") {
    const publica = process.env.VITE_VAPID_PUBLIC_KEY;
    const { count } = await supabase
      .from("push_suscripciones")
      .select("id", { count: "exact", head: true })
      .eq("empleado_id", quien.id);
    return res.status(200).json({
      configurado: pushDisponible(),
      servidorPublicaFp: publica ? huellaClave(publica) : null,
      suscripcionesDeEsteUsuario: count || 0,
    });
  }

  // Prueba de notificación (solo admin): se manda un push a uno mismo + deja una fila en la
  // campana, y devuelve el resultado exacto para saber si de verdad llega. Vive AQUÍ, y no en su
  // propio endpoint, porque Vercel Hobby topa en 12 funciones y ya estábamos en el límite.
  if (req.method === "POST" && req.body?.accion === "probar") {
    // Cualquier usuario puede probar SU PROPIO push (solo se envía a sí mismo): sirve para que
    // cada quien confirme que su teléfono recibe, sin depender de un admin.
    const aviso = {
      titulo: "Prueba de notificación",
      cuerpo: "Si ves esto en tu teléfono, el push funciona. 🎉",
      url: "/",
    };
    try {
      await supabase.from("notificaciones").insert({ empleado_id: quien.id, tipo: "prueba", ...aviso });
    } catch (e) {
      console.error("Error insertando notificación de prueba:", e?.message || e);
    }
    if (!pushDisponible()) {
      return res.status(200).json({ ok: true, enviados: 0, motivo: "push no configurado en el servidor" });
    }
    const { enviados, limpiados } = await enviar(quien.id, aviso);
    return res.status(200).json({ ok: true, enviados, limpiados });
  }

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
