import { configOk, admin, quienLlama } from "./_auth.js";
import { notificar } from "./_notificaciones.js";
import { nuevaSala } from "./_jitsi.js";

/**
 * Convoca una reunión por vídeo e invita a personal de Pulse.
 *
 * Pasa por el servidor por tres razones que no se pueden resolver desde el navegador:
 *   1. El identificador de la sala lo genera aquí. Si lo mandara el cliente, podría elegir el
 *      de una reunión ajena y colarse en ella con su propio token.
 *   2. Los avisos usan `notificar()`, que necesita la clave privada de VAPID del push.
 *   3. La reunión y sus invitados se crean juntos. Media convocatoria —una reunión sin
 *      invitados, o invitados sin reunión— no le sirve a nadie.
 */
const RUTA_POR_ROL = {
  admin: "/admin/mensajes",
  admin_plus: "/admin/mensajes",
  rh: "/rh/mensajes",
  psicologa: "/psicologa/mensajes",
  empleado: "/empleado/mensajes",
  doctor: "/doctor/mensajes",
};

const PUEDE_CONVOCAR = ["admin", "admin_plus", "rh", "psicologa"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  if (!configOk()) return res.status(500).json({ error: "Supabase no está configurado." });

  const quien = await quienLlama(req);
  if (!quien) return res.status(401).json({ error: "Sesión inválida." });
  if (!PUEDE_CONVOCAR.includes(quien.role)) {
    return res.status(403).json({ error: "Solo Recursos Humanos, psicología y administración pueden convocar reuniones." });
  }

  const { titulo, descripcion, inicio, fin, invitados } = req.body || {};
  if (!titulo?.trim() || !inicio) {
    return res.status(400).json({ error: "Falta el título o la fecha de la reunión." });
  }
  if (!Array.isArray(invitados) || invitados.length === 0) {
    return res.status(400).json({ error: "Invita al menos a una persona." });
  }

  const supabase = admin();

  // Que los invitados existan y estén activos. Sin esto, una lista con un id inventado crea
  // una reunión a la que nadie puede entrar, y el fallo solo se ve a la hora de empezar.
  const ids = [...new Set(invitados.filter(Boolean))].slice(0, 50);
  const { data: personas } = await supabase
    .from("usuarios")
    .select("id, name, role, inactivo, archivado")
    .in("id", ids);

  const validos = (personas || []).filter((p) => !p.inactivo && !p.archivado);
  if (validos.length === 0) {
    return res.status(400).json({ error: "Ninguna de las personas invitadas está activa." });
  }

  const { data: reunion, error } = await supabase
    .from("reuniones")
    .insert({
      titulo: String(titulo).trim().slice(0, 160),
      descripcion: descripcion ? String(descripcion).trim().slice(0, 2000) : null,
      inicio,
      fin: fin || null,
      sala: nuevaSala(),
      creado_por: quien.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creando la reunión:", error);
    return res.status(500).json({ error: "No se pudo crear la reunión." });
  }

  const { error: errorInvitados } = await supabase
    .from("reunion_invitados")
    .insert(validos.map((p) => ({ reunion_id: reunion.id, usuario_id: p.id })));

  if (errorInvitados) {
    // Una reunión sin invitados no la ve nadie más que quien la creó: es basura silenciosa.
    // Se deshace para no dejarla ahí.
    await supabase.from("reuniones").delete().eq("id", reunion.id);
    console.error("Error invitando:", errorInvitados);
    return res.status(500).json({ error: "No se pudo invitar a las personas." });
  }

  // Los avisos van al final y en paralelo: `notificar` nunca lanza, así que si el push falla
  // la reunión queda creada igual. Lo importante ya está guardado.
  const cuando = new Date(inicio).toLocaleString("es-MX", {
    timeZone: "America/Monterrey", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
  });
  await Promise.all(
    validos.map((p) =>
      notificar(p.id, {
        tipo: "reunion",
        titulo: `${quien.name} te invitó a una reunión`,
        cuerpo: `${reunion.titulo} · ${cuando}`,
        url: RUTA_POR_ROL[p.role] || "/",
      })
    )
  );

  return res.status(200).json({ ok: true, reunion });
}
