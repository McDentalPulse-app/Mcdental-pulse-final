import { configOk, admin } from "./_auth.js";
import { notificarGestion } from "./_notificaciones.js";

/**
 * Recibe el parte diario del respaldo externo. Lo llama la máquina de la OFICINA, no un cron
 * de aquí y no una persona.
 *
 * El respaldo lo tira la oficina (ver la migración 093 para el porqué), así que la VPS no
 * puede comprobar por sí misma si la copia se hizo. Este endpoint es el canal de vuelta: la
 * oficina cuenta cómo le fue y aquí queda registrado.
 *
 * Si el parte viene en fallo, se avisa EN EL ACTO. Un respaldo roto que se descubre el día que
 * hace falta no es un respaldo.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  // Mismo secreto que el resto de tareas automáticas. Sin él, cualquiera podría inventarse
  // latidos correctos y silenciar la alarma justo cuando importa.
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error("CRON_SECRET no configurado: rechazando por seguridad.");
    return res.status(500).json({ error: "Tarea no configurada." });
  }
  if (req.headers.authorization !== `Bearer ${secreto}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const { ok, archivo, sha256, bytes, detalle } = req.body || {};
  if (typeof ok !== "boolean") {
    return res.status(400).json({ error: "Falta 'ok'." });
  }

  const supabase = admin();
  const { error } = await supabase.from("respaldo_latidos").insert({
    ok,
    // Recortados a lo razonable: esto viene de fuera y no hay motivo para aceptar
    // cadenas arbitrariamente largas en una tabla que solo guarda un parte.
    archivo: archivo ? String(archivo).slice(0, 200) : null,
    sha256: sha256 ? String(sha256).slice(0, 64) : null,
    bytes: Number.isFinite(Number(bytes)) ? Math.trunc(Number(bytes)) : null,
    detalle: detalle ? String(detalle).slice(0, 500) : null,
  });

  if (error) {
    console.error("Error guardando el latido del respaldo:", error);
    return res.status(500).json({ error: "No se pudo registrar el latido." });
  }

  if (!ok) {
    await notificarGestion({
      tipo: "respaldo",
      titulo: "El respaldo externo falló anoche",
      cuerpo: `La copia fuera de la VPS no se pudo verificar: ${detalle || "sin detalle"}.`,
      url: { admin: "/admin", rh: "/rh", psicologa: "/psicologa" },
    });
  }

  console.log(`Latido de respaldo: ${ok ? "ok" : "FALLO"} ${archivo || ""} ${detalle || ""}`);
  return res.status(200).json({ ok: true });
}
