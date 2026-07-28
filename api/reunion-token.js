import { configOk, admin, quienLlama } from "./_auth.js";
import { firmarTokenJitsi, jitsiConfigurado } from "./_jitsi.js";

/**
 * Entrega el token para entrar a una sala de Jitsi.
 *
 * AQUÍ SE APLICA DE VERDAD LA LISTA DE INVITADOS. Prosody no sabe nada de Pulse: solo
 * comprueba que el JWT esté bien firmado y que su claim `room` coincida con la sala. Todo lo
 * demás —la pantalla de reuniones, los avisos, la lista de personas— es interfaz. Si esta
 * comprobación se relajara, la lista de invitados pasaría a ser decorativa aunque en pantalla
 * siguiera viéndose igual.
 *
 * Por eso la consulta se hace con service_role y se decide aquí, y no confiando en que el
 * cliente pida solo las salas que le tocan.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  if (!configOk()) return res.status(500).json({ error: "Supabase no está configurado." });
  if (!jitsiConfigurado()) {
    return res.status(500).json({ error: "El servidor de reuniones no está configurado." });
  }

  const quien = await quienLlama(req);
  if (!quien) return res.status(401).json({ error: "Sesión inválida." });

  const { reunionId } = req.body || {};
  if (!reunionId) return res.status(400).json({ error: "Falta la reunión." });

  const supabase = admin();

  const { data: reunion } = await supabase
    .from("reuniones")
    .select("id, sala, estado, creado_por, titulo")
    .eq("id", reunionId)
    .single();

  if (!reunion) return res.status(404).json({ error: "La reunión no existe." });
  if (reunion.estado === "cancelada") {
    return res.status(409).json({ error: "Esta reunión fue cancelada." });
  }

  const esAnfitrion = reunion.creado_por === quien.id;

  if (!esAnfitrion) {
    const { data: invitacion } = await supabase
      .from("reunion_invitados")
      .select("usuario_id")
      .eq("reunion_id", reunionId)
      .eq("usuario_id", quien.id)
      .maybeSingle();

    if (!invitacion) {
      // Mensaje deliberadamente parco: decir "existe pero no estás invitado" confirmaría la
      // existencia de una reunión ajena a quien anda probando identificadores.
      return res.status(403).json({ error: "No tienes acceso a esta reunión." });
    }
  }

  const token = firmarTokenJitsi({
    sala: reunion.sala,
    usuario: { id: quien.id, name: quien.name, avatarUrl: quien.avatar_url },
    esAnfitrion,
  });

  return res.status(200).json({
    ok: true,
    token,
    sala: reunion.sala,
    dominio: process.env.JITSI_DOMINIO || "meet.mcdentalpulse.duckdns.org",
    esAnfitrion,
  });
}
