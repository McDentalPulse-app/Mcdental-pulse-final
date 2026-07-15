import { admin, configOk } from "./_auth.js";
import { enviar, pushDisponible } from "./_push.js";

/**
 * Dos tareas de fondo en un solo endpoint, un solo cron diario.
 *
 * POR QUÉ VAN JUNTAS: el plan Hobby de Vercel limita a 12 Serverless Functions por deployment
 * (error `exceeded_serverless_functions_per_deployment` si se pasa). Recordatorio de encuesta y
 * revisión de tickets no comparten nada de lógica, pero las dos son "trabajo de fondo que solo
 * llama el cron, nunca una persona" — fusionarlas en un archivo es gratis en claridad y evita
 * gastar una función completa en algo que de todos modos no tiene UI propia. Si algún día hace
 * falta separarlas (por ejemplo, para darles horarios distintos), es tan simple como partir este
 * archivo en dos otra vez.
 *
 * Corre UNA vez al día (Hobby no admite más). Dentro, el recordatorio de encuesta solo actúa
 * martes/jueves/viernes (hora de México) — el cron llama todos los días, pero el aviso de
 * encuesta no tiene por qué mandarse los otros cuatro.
 */

const MCTIC_API_URL = process.env.MCTIC_API_URL;
const MCTIC_INTEGRATION_KEY = process.env.MCTIC_INTEGRATION_KEY;

// Misma cuenta de semana ISO que src/utils/constants.js (getISOWeek). Se reimplementa aquí
// porque api/ no importa hoy desde src/ — son dos bundles serverless independientes.
const getISOWeek = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

// Día ISO (1=lunes...7=domingo) en hora de México, sin depender de ninguna librería.
const diaISOEnMexico = () => {
  const nombre = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Monterrey",
    weekday: "short",
  }).format(new Date());
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[nombre];
};

const DIAS_RECORDATORIO_ENCUESTA = [2, 4, 5]; // martes, jueves, viernes

/** Recordatorio de encuesta semanal sin responder. Como el filtro siempre es "sin encuesta de
 * ESTA semana", en cuanto la persona responde deja de recibir el aviso solo, sin tabla de
 * control aparte. */
const recordatorioEncuestas = async (supabase) => {
  const semana = getISOWeek();

  const { data: empleados, error: errorEmpleados } = await supabase
    .from("usuarios")
    .select("id, name")
    .eq("role", "empleado")
    .eq("inactivo", false);

  if (errorEmpleados) {
    console.error("Error buscando empleados:", errorEmpleados);
    return { avisados: 0, error: "No se pudieron buscar los empleados." };
  }
  if (!empleados?.length) return { avisados: 0 };

  const { data: respondidas, error: errorEncuestas } = await supabase
    .from("encuestas")
    .select("empleado_id")
    .eq("semana", semana);

  if (errorEncuestas) {
    console.error("Error buscando encuestas de la semana:", errorEncuestas);
    return { avisados: 0, error: "No se pudieron buscar las encuestas." };
  }

  const yaRespondieron = new Set((respondidas || []).map((e) => e.empleado_id));
  const pendientes = empleados.filter((u) => !yaRespondieron.has(u.id));

  await Promise.all(
    pendientes.map((u) =>
      enviar(u.id, {
        titulo: "Encuesta semanal pendiente",
        cuerpo: "Todavía no respondes tu encuesta de esta semana. Te toma un par de minutos.",
        url: "/empleado/encuesta",
      }).catch(() => {})
    )
  );

  return { semana, avisados: pendientes.length };
};

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

/** Detecta cambios de estado en los tickets de soporte (MCTIC) y avisa por push.
 *
 * MCTIC es un sistema externo y no manda webhook: lo único que se puede hacer es preguntarle
 * de vez en cuando y comparar contra la última foto guardada en `soporte_tickets_estado`. La
 * primera vez que se ve un ticket no se avisa, solo se siembra la fila — si no, el primer
 * barrido tras desplegar esto mandaría un push por cada ticket que ya existiera de antes.
 *
 * Solo se consulta a quien PODRÍA recibir el aviso: las personas con al menos una suscripción
 * de push activa. Consultar a todo el mundo sería pegarle a MCTIC por gente que de todos modos
 * no puede recibir nada. */
const revisarTickets = async (supabase) => {
  if (!MCTIC_API_URL || !MCTIC_INTEGRATION_KEY) return { revisados: 0, motivo: "MCTIC no configurado" };

  const { data: subs, error: errorSubs } = await supabase
    .from("push_suscripciones")
    .select("empleado_id");

  if (errorSubs) {
    console.error("Error buscando suscripciones:", errorSubs);
    return { revisados: 0, error: "No se pudieron buscar las suscripciones." };
  }

  const empleadoIds = [...new Set((subs || []).map((s) => s.empleado_id))];
  if (!empleadoIds.length) return { revisados: 0 };

  const { data: usuarios, error: errorUsuarios } = await supabase
    .from("usuarios")
    .select("id, role, synthetic_email")
    .in("id", empleadoIds);

  if (errorUsuarios) {
    console.error("Error buscando usuarios:", errorUsuarios);
    return { revisados: 0, error: "No se pudieron buscar los usuarios." };
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
        return; // MCTIC caído o inalcanzable en este barrido: se reintenta al día siguiente.
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

  return { revisados, avisados };
};

export default async function handler(req, res) {
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  // Mismo candado que api/limpiar-fotos.js: sin esto, cualquiera podría disparar el barrido.
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const supabase = admin();
  const resultado = {};

  if (pushDisponible()) {
    if (DIAS_RECORDATORIO_ENCUESTA.includes(diaISOEnMexico())) {
      resultado.encuestas = await recordatorioEncuestas(supabase);
    }
    resultado.tickets = await revisarTickets(supabase);
  } else {
    resultado.motivo = "push no configurado";
  }

  return res.status(200).json(resultado);
}
