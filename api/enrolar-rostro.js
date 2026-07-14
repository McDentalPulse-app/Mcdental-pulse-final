import { configOk, admin, quienLlama } from "./_auth.js";
import { calcularHuella } from "./_rostro.js";

const MIN_FOTOS = 1;
const MAX_FOTOS = 3;

/**
 * Registra la cara de referencia de un empleado, a partir de las fotos que ya subió.
 *
 * DOS CAMINOS, y la diferencia entre ellos es toda la seguridad del cotejo:
 *
 *   - El EMPLEADO se registra a sí mismo -> queda PENDIENTE. No sirve para nada hasta que
 *     RH lo mire y confirme que esa cara es la suya.
 *   - RH registra a alguien (presencialmente) -> queda APROBADO directamente. RH tiene al
 *     empleado delante: ya hizo la comprobación de identidad.
 *
 * Un empleado NUNCA puede registrar la cara de otro, ni aprobarse la suya. Si pudiera, el
 * compañero que le robó la contraseña a Juan enrolaría SU PROPIA cara en la cuenta de Juan
 * y a partir de ahí checaría por él con un 99% de parecido — verificado por el sistema. El
 * fraude quedaría legitimado y sería indetectable.
 *
 * Las huellas las calcula el SERVIDOR a partir de las fotos. El cliente no manda números:
 * si pudiera, mandaría los que le conviniera.
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

  const { empleadoId, fotos, consentimiento } = req.body || {};

  if (!Array.isArray(fotos) || fotos.length < MIN_FOTOS || fotos.length > MAX_FOTOS) {
    return res.status(400).json({ error: `Hacen falta entre ${MIN_FOTOS} y ${MAX_FOTOS} fotos.` });
  }
  if (consentimiento !== true) {
    // Una cara cotejada es dato personal SENSIBLE. Sin consentimiento expreso no se
    // registra: no es burocracia, es la condición para que esto pueda existir.
    return res.status(400).json({ error: "Falta el consentimiento." });
  }

  const esGestor = ["admin", "rh"].includes(quien.role);
  const destino = empleadoId || quien.id;

  // La línea que sostiene todo: nadie registra la cara de otro salvo RH/admin.
  if (destino !== quien.id && !esGestor) {
    return res.status(403).json({ error: "No puedes registrar el rostro de otra persona." });
  }

  const supabase = admin();

  // Un empleado no puede rehacer un registro ya APROBADO: si pudiera, cambiaría la cara de
  // referencia por otra en cualquier momento y el control se evaporaría. Solo RH lo reabre.
  const { data: existente } = await supabase
    .from("rostros")
    .select("id, estado")
    .eq("empleado_id", destino)
    .single();

  if (existente?.estado === "aprobado" && !esGestor) {
    return res.status(409).json({
      error: "Tu rostro ya está registrado. Si necesitas cambiarlo, pídeselo a Recursos Humanos.",
    });
  }

  // Las huellas, a partir de las fotos que el cliente ya subió al bucket.
  const huellas = [];
  for (const ruta of fotos) {
    const { data: archivo, error: errorDescarga } = await supabase.storage
      .from("rostros")
      .download(ruta);

    if (errorDescarga || !archivo) {
      console.error("No se pudo descargar la foto de registro:", errorDescarga);
      return res.status(400).json({ error: "No se pudo leer una de las fotos." });
    }

    let huella;
    try {
      huella = await calcularHuella(Buffer.from(await archivo.arrayBuffer()));
    } catch (error) {
      console.error("Error calculando la huella facial:", error);
      return res.status(500).json({ error: "No se pudieron procesar las fotos." });
    }

    if (!huella) {
      return res.status(400).json({
        error: "En una de las fotos no se ve tu cara. Repítelas con buena luz y de frente.",
      });
    }
    huellas.push({ huella, ruta });
  }

  // RH registrando en persona ya hizo la comprobación de identidad. El empleado
  // registrándose a sí mismo, no: su registro queda pendiente de que alguien lo mire.
  const estado = esGestor && destino !== quien.id ? "aprobado" : "pendiente";

  const { data: rostro, error: errorRostro } = await supabase
    .from("rostros")
    .upsert(
      {
        empleado_id: destino,
        huella: huellas[0].huella, // compatibilidad con la columna vieja
        selfie_path: huellas[0].ruta,
        consentimiento_en: new Date().toISOString(),
        enrolado_por: quien.id,
        estado,
        revisado_por: estado === "aprobado" ? quien.id : null,
        revisado_en: estado === "aprobado" ? new Date().toISOString() : null,
        motivo_rechazo: null,
      },
      { onConflict: "empleado_id" }
    )
    .select("id")
    .single();

  if (errorRostro) {
    console.error("Error guardando el rostro:", errorRostro);
    return res.status(500).json({ error: "No se pudo guardar el rostro." });
  }

  // Se reemplazan las fotos anteriores: un re-registro sustituye, no acumula. Si no, una
  // cara vieja seguiría dando por buena a quien ya no debería pasar.
  await supabase.from("rostro_fotos").delete().eq("rostro_id", rostro.id);

  const { error: errorFotos } = await supabase.from("rostro_fotos").insert(
    huellas.map(({ huella, ruta }) => ({
      rostro_id: rostro.id,
      huella,
      selfie_path: ruta,
    }))
  );

  if (errorFotos) {
    console.error("Error guardando las fotos del rostro:", errorFotos);
    return res.status(500).json({ error: "No se pudieron guardar las fotos." });
  }

  return res.status(200).json({ ok: true, estado });
}
