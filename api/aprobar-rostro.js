import { configOk, admin, quienLlama } from "./_auth.js";
import { similitud } from "./_rostro.js";

/**
 * Por encima de esto, dos caras DISTINTAS se parecen lo bastante como para que el cotejo pueda
 * llegar a confundirlas. No es un umbral de bloqueo: es un umbral de AVISO.
 *
 * El caso difícil nunca fue el desconocido —da 0.04-0.17, ni se acerca al 0.50— sino el
 * parecido: un hermano, un primo. En las pruebas reales dos personas parecidas llegaron a 0.37,
 * a solo 0.13 de colarse. 0.40 deja margen para verlas venir antes de que una pueda fichar por
 * la otra.
 */
const UMBRAL_PARECIDO = 0.4;

/**
 * Compara la cara recién aprobada contra TODAS las demás ya aprobadas.
 *
 * Con 60 empleados son 60 comparaciones de 128 números: milisegundos. Sin esto, dos caras que
 * el cotejo puede confundir conviven en el sistema y nadie se entera hasta el día que una checa
 * por la otra — y entonces el sistema no detecta el fraude: lo certifica.
 *
 * EL PARECIDO ES SIMÉTRICO, así que se anota EN LAS DOS FICHAS. Si solo se marcara la que se
 * aprobó hoy, RH abriría la ficha de Juan, no vería ningún aviso, y no sabría que hay otra cara
 * ahí fuera que el sistema confunde con la suya.
 */
const anotarParecidos = async (supabase, empleadoId) => {
  const { data: rostros, error } = await supabase
    .from("rostros")
    .select("empleado_id, huella, parecido_maximo")
    .eq("estado", "aprobado")
    .not("huella", "is", null);

  if (error || !rostros) {
    // Que falle el aviso no puede tumbar la aprobación: el rostro ya está aprobado y la persona
    // tiene que poder fichar. Se queda sin la anotación, no sin trabajar.
    console.error("No se pudieron comparar los rostros:", error);
    return null;
  }

  const nuevo = rostros.find((r) => r.empleado_id === empleadoId);
  if (!nuevo?.huella?.length) return null;

  let peor = null;

  for (const otro of rostros) {
    if (otro.empleado_id === empleadoId || !otro.huella?.length) continue;

    const score = similitud(nuevo.huella, otro.huella);
    if (score == null || score < UMBRAL_PARECIDO) continue;

    if (!peor || score > peor.score) peor = { score, empleadoId: otro.empleado_id };

    // El otro lado del par: solo se pisa su marca si esta es peor que la que ya tenía.
    if (otro.parecido_maximo == null || score > otro.parecido_maximo) {
      await supabase
        .from("rostros")
        .update({ parecido_maximo: score, parecido_con: empleadoId })
        .eq("empleado_id", otro.empleado_id);
    }
  }

  await supabase
    .from("rostros")
    .update({
      parecido_maximo: peor?.score ?? null,
      parecido_con: peor?.empleadoId ?? null,
    })
    .eq("empleado_id", empleadoId);

  return peor;
};

/**
 * Aprueba o rechaza el rostro que un empleado registró por su cuenta.
 *
 * ESTE ENDPOINT ES EL COTEJO ENTERO. Todo lo demás —los modelos, las huellas, los
 * umbrales— depende de que aquí alguien haya mirado las fotos y haya afirmado: "esta cara
 * es la de esta persona".
 *
 * Si se aprueba sin mirar, el compañero que le robó la contraseña a Juan registra SU
 * PROPIA cara en la cuenta de Juan, se aprueba de un clic, y a partir de ese momento checa
 * por él con un 99% de parecido — verificado y bendecido por el sistema. El cotejo dejaría
 * de detectar el fraude: pasaría a certificarlo.
 *
 * Por eso queda registrado QUIÉN aprobó y CUÁNDO. Aprobar es afirmar una identidad, y eso
 * tiene un responsable con nombre.
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
    return res.status(403).json({ error: "Solo Recursos Humanos puede aprobar un rostro." });
  }

  const { empleadoId, aprobar, motivo } = req.body || {};
  if (!empleadoId || typeof aprobar !== "boolean") {
    return res.status(400).json({ error: "Faltan datos." });
  }

  const supabase = admin();

  const { error } = await supabase
    .from("rostros")
    .update({
      estado: aprobar ? "aprobado" : "rechazado",
      revisado_por: quien.id,
      revisado_en: new Date().toISOString(),
      // La cara caduca a los 6 meses: la gente cambia (barba, gafas, peso) y una referencia
      // vieja acaba rechazando a su propio dueño — que es el peor fallo posible, porque le
      // pasa a la persona honrada y le impide trabajar.
      vence_en: aprobar
        ? new Date(Date.now() + 182 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      motivo_rechazo: aprobar ? null : (motivo || "Las fotos no sirven o no corresponden."),
    })
    .eq("empleado_id", empleadoId)
    .eq("estado", "pendiente"); // solo se revisa lo pendiente: no se re-aprueba a la ligera

  if (error) {
    console.error("Error revisando el rostro:", error);
    return res.status(500).json({ error: "No se pudo guardar la revisión." });
  }

  // Al aprobar (no al rechazar: una cara rechazada no entra al cotejo y no puede confundirse
  // con nadie) se busca a quién se parece demasiado.
  const parecido = aprobar ? await anotarParecidos(supabase, empleadoId) : null;

  if (parecido) {
    const { data: otro } = await supabase
      .from("usuarios")
      .select("name")
      .eq("id", parecido.empleadoId)
      .single();

    return res.status(200).json({
      ok: true,
      aviso: {
        score: parecido.score,
        empleadoId: parecido.empleadoId,
        nombre: otro?.name ?? "otro empleado",
      },
    });
  }

  return res.status(200).json({ ok: true });
}
