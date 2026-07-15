import { admin, configOk } from "./_auth.js";
import { enviar, pushDisponible } from "./_push.js";

/**
 * Detecta cambios de estado en los tickets de soporte (MCTIC) y avisa por push.
 *
 * MCTIC es un sistema externo y no manda webhook: lo único que se puede hacer es preguntarle
 * de vez en cuando (lo llama un cron de Vercel cada 15 minutos) y comparar contra la última
 * foto guardada en `soporte_tickets_estado`. La primera vez que se ve un ticket no se avisa,
 * solo se siembra la fila — si no, el primer barrido tras desplegar esto mandaría un push por
 * cada ticket que ya existiera de antes.
 *
 * Solo se consulta a quien PODRÍA recibir el aviso: las personas con al menos una suscripción
 * de push activa. Consultar a todo el mundo sería pegarle a MCTIC por gente que de todos modos
 * no puede recibir nada.
 */

const MCTIC_API_URL = process.env.MCTIC_API_URL;
const MCTIC_INTEGRATION_KEY = process.env.MCTIC_INTEGRATION_KEY;

const ESTADO_LABEL = {
  ABIERTO: "abierto",
  EN_PROGRESO: "en progreso",
  RESUELTO: "resuelto",
  CERRADO: "cerrado",
};

const RUTA_POR_ROL = {
  empleado: "/empleado/soporte",
  rh: "/rh/soporte",
  psicologa: "/psicologa/soporte",
  admin: "/admin/soporte",
};

export default async function handler(req, res) {
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  if (!MCTIC_API_URL || !MCTIC_INTEGRATION_KEY) {
    return res.status(200).json({ revisados: 0, motivo: "MCTIC no configurado" });
  }
  if (!pushDisponible()) {
    return res.status(200).json({ revisados: 0, motivo: "push no configurado" });
  }

  const supabase = admin();

  // Solo a quien tiene al menos una suscripción de push activa (no tiene caso preguntarle a
  // MCTIC por alguien que de todos modos no puede recibir el aviso).
  const { data: subs, error: errorSubs } = await supabase
    .from("push_suscripciones")
    .select("empleado_id");

  if (errorSubs) {
    console.error("Error buscando suscripciones:", errorSubs);
    return res.status(500).json({ error: "No se pudieron buscar las suscripciones." });
  }

  const empleadoIds = [...new Set((subs || []).map((s) => s.empleado_id))];
  if (!empleadoIds.length) return res.status(200).json({ revisados: 0 });

  const { data: usuarios, error: errorUsuarios } = await supabase
    .from("usuarios")
    .select("id, role, synthetic_email")
    .in("id", empleadoIds);

  if (errorUsuarios) {
    console.error("Error buscando usuarios:", errorUsuarios);
    return res.status(500).json({ error: "No se pudieron buscar los usuarios." });
  }

  let revisados = 0;
  let avisados = 0;

  await Promise.all(
    (usuarios || []).map(async (u) => {
      if (!u.synthetic_email) return;

      let tickets;
      try {
        const resp = await fetch(
          `${MCTIC_API_URL}/api/v1/integrations/helpdesk/tickets?requester=${encodeURIComponent(u.synthetic_email)}`,
          { headers: { "X-Integration-Key": MCTIC_INTEGRATION_KEY } },
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) return;
        tickets = data?.data ?? [];
      } catch {
        return; // MCTIC caído o inalcanzable en este barrido: se reintenta en 15 minutos.
      }

      revisados += 1;
      if (!tickets.length) return;

      const { data: cache } = await supabase
        .from("soporte_tickets_estado")
        .select("ticket_id, status")
        .eq("empleado_id", u.id);

      const estadoPrevio = new Map((cache || []).map((c) => [c.ticket_id, c.status]));

      for (const t of tickets) {
        const ticketId = String(t.id);
        const previo = estadoPrevio.get(ticketId);

        if (previo === undefined) {
          // Primera vez que se ve: se siembra sin avisar.
          await supabase
            .from("soporte_tickets_estado")
            .upsert(
              { empleado_id: u.id, ticket_id: ticketId, status: t.status, actualizado_en: new Date().toISOString() },
              { onConflict: "empleado_id,ticket_id" }
            );
          continue;
        }

        if (previo !== t.status) {
          await supabase
            .from("soporte_tickets_estado")
            .upsert(
              { empleado_id: u.id, ticket_id: ticketId, status: t.status, actualizado_en: new Date().toISOString() },
              { onConflict: "empleado_id,ticket_id" }
            );

          const estadoTexto = ESTADO_LABEL[t.status] || t.status;
          enviar(u.id, {
            titulo: "Tu ticket de soporte cambió de estado",
            cuerpo: `#${ticketId} · ${t.subject || "Ticket"} ahora está ${estadoTexto}.`,
            url: RUTA_POR_ROL[u.role] || "/empleado/soporte",
          }).catch(() => {});
          avisados += 1;
        }
      }
    })
  );

  return res.status(200).json({ revisados, avisados });
}
