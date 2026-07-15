import { admin, configOk } from "./_auth.js";
import { enviar, pushDisponible } from "./_push.js";

/**
 * Recordatorio de encuesta semanal sin responder. Lo llama un cron de Vercel varias veces por
 * semana (martes, jueves, viernes): como el filtro siempre es "sin encuesta de ESTA semana",
 * en cuanto la persona responde deja de recibir el aviso solo, sin tabla de control aparte.
 *
 * Misma cuenta de semana ISO que src/utils/constants.js (getISOWeek). Se reimplementa aquí
 * porque api/ no importa hoy desde src/ — son dos bundles serverless independientes.
 */
const getISOWeek = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
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

  if (!pushDisponible()) {
    return res.status(200).json({ avisados: 0, motivo: "push no configurado" });
  }

  const supabase = admin();
  const semana = getISOWeek();

  const { data: empleados, error: errorEmpleados } = await supabase
    .from("usuarios")
    .select("id, name")
    .eq("role", "empleado")
    .eq("inactivo", false);

  if (errorEmpleados) {
    console.error("Error buscando empleados:", errorEmpleados);
    return res.status(500).json({ error: "No se pudieron buscar los empleados." });
  }
  if (!empleados?.length) return res.status(200).json({ avisados: 0 });

  const { data: respondidas, error: errorEncuestas } = await supabase
    .from("encuestas")
    .select("empleado_id")
    .eq("semana", semana);

  if (errorEncuestas) {
    console.error("Error buscando encuestas de la semana:", errorEncuestas);
    return res.status(500).json({ error: "No se pudieron buscar las encuestas." });
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

  return res.status(200).json({ semana, avisados: pendientes.length });
}
