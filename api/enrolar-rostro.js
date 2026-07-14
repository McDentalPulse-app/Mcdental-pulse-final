import { configOk, admin, quienLlama } from "./_auth.js";
import { calcularHuella } from "./_rostro.js";

/**
 * Enrola la cara de referencia de un empleado.
 *
 * SOLO RH Y ADMIN, y presencialmente. Es la regla que sostiene todo el cotejo: si el
 * empleado pudiera enrolarse solo, el compañero que le robó la contraseña enrolaría SU
 * cara en la cuenta ajena, y a partir de ahí checaría por él con un parecido del 99% —
 * verificado y bendecido por el propio sistema. El fraude quedaría legitimado.
 *
 * La huella la calcula el SERVIDOR a partir de la foto. El cliente no manda números: si
 * pudiera, enrolaría la huella que quisiera.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!configOk()) {
    return res.status(500).json({ error: "Supabase no está configurado en el servidor." });
  }

  const quien = await quienLlama(req);
  if (!quien) {
    return res.status(401).json({ error: "Sesión inválida." });
  }
  if (!["admin", "rh"].includes(quien.role)) {
    // No es un detalle de permisos: es la línea que impide que alguien se enrole a sí mismo.
    return res.status(403).json({ error: "Solo Recursos Humanos puede enrolar un rostro." });
  }

  const { empleadoId, selfiePath, consentimiento } = req.body || {};

  if (!empleadoId || !selfiePath) {
    return res.status(400).json({ error: "Faltan el empleado o la foto." });
  }
  if (consentimiento !== true) {
    // Una cara cotejada es dato personal SENSIBLE. Sin consentimiento expreso del empleado
    // no se enrola: no es burocracia, es la condición para que esto pueda existir.
    return res.status(400).json({ error: "Falta el consentimiento del empleado." });
  }

  const supabase = admin();

  const { data: archivo, error: errorDescarga } = await supabase.storage
    .from("rostros")
    .download(selfiePath);

  if (errorDescarga || !archivo) {
    console.error("No se pudo descargar la foto de enrolado:", errorDescarga);
    return res.status(400).json({ error: "No se pudo leer la foto." });
  }

  let huella;
  try {
    huella = await calcularHuella(Buffer.from(await archivo.arrayBuffer()));
  } catch (error) {
    console.error("Error calculando la huella facial:", error);
    return res.status(500).json({ error: "No se pudo procesar la foto." });
  }

  if (!huella) {
    return res.status(400).json({
      error: "No se detecta una cara en la foto. Repite la captura con buena luz y de frente.",
    });
  }

  const { error: errorGuardado } = await supabase
    .from("rostros")
    .upsert(
      {
        empleado_id: empleadoId,
        huella,
        selfie_path: selfiePath,
        consentimiento_en: new Date().toISOString(),
        enrolado_por: quien.id,
      },
      { onConflict: "empleado_id" }
    );

  if (errorGuardado) {
    console.error("Error guardando el rostro:", errorGuardado);
    return res.status(500).json({ error: "No se pudo guardar el rostro." });
  }

  return res.status(200).json({ ok: true });
}
