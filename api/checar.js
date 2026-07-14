import { configOk, admin, quienLlama } from "./_auth.js";
import { calcularHuella, similitud, UMBRAL_MISMA_PERSONA } from "./_rostro.js";

/**
 * Registrar una checada. Es el ÚNICO camino: la RPC ya no la puede llamar el navegador.
 *
 * El orden importa y es lo que hace que esto bloquee de verdad: primero se coteja la cara,
 * y SOLO si coincide se crea la checada. Antes el cotejo corría después, sobre una checada
 * ya escrita — servía para marcar, no para impedir. Y mientras la RPC fuera llamable desde
 * el navegador, cualquiera se la saltaba con dos líneas en la consola.
 *
 * BLOQUEO ESTRICTO: si la cara no coincide, NO hay checada. Nunca. No hay número de
 * reintentos tras el cual el sistema se rinda y deje pasar — eso sería una puerta que el
 * impostor terco solo tendría que empujar tres veces.
 *
 * ¿Y la persona honrada a la que el modelo no reconoce (gafas nuevas, contraluz, barba)?
 * Tiene DOS salidas, y las dos existen ya:
 *
 *   1. Los lentes están cubiertos en el registro: quien los usa aporta fotos con y sin, y
 *      el cotejo se queda con el mejor parecido. Es la causa nº 1 de rechazo injusto y está
 *      atacada de raíz.
 *   2. Si aun así no la reconoce, RH le registra la checada A MANO (ya existe) y le vuelve a
 *      tomar el rostro. Es fricción real, sí — pero es fricción con una persona detrás que
 *      resuelve, no un empleado atrapado en un bucle.
 *
 * Los intentos fallidos se cuentan igualmente: no para rendirse, sino para decirle a partir
 * de cuándo deje de insistir y hable con RH, y para que RH vea quién está peleándose con el
 * sistema.
 */

const INTENTOS_ANTES_DE_AVISAR = 3;

/**
 * Tope duro de intentos fallidos por ventana. NO es la regla de negocio: es el freno de
 * COSTE.
 *
 * Cada llamada a este endpoint cuesta dos inferencias de red neuronal. Sin tope, alguien
 * con un script puede llamarlo en bucle con fotos que no coinciden y disparar la factura de
 * CPU de Vercel — no es fraude, es una cuenta que llega a fin de mes. Y como la comprobación
 * va ANTES de tocar los modelos, un abuso cuesta una consulta a la base, no dos inferencias.
 *
 * 12 en 15 minutos es de sobra para una persona que se está peleando con la luz de la mañana
 * (tras 3 fallos ya se le dice que hable con RH) y ridículamente poco para un bucle.
 */
const TOPE_INTENTOS = 12;

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

  const { tipo, selfiePath, lat, lng, precision, deviceId } = req.body || {};
  if (tipo !== "entrada" && tipo !== "salida") {
    return res.status(400).json({ error: "Tipo de checada inválido." });
  }

  const supabase = admin();

  const desdeVentana = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const contarIntentos = async () => {
    const { count } = await supabase
      .from("cotejo_intentos")
      .select("id", { count: "exact", head: true })
      .eq("empleado_id", quien.id)
      .gte("creado_en", desdeVentana);
    return count || 0;
  };

  // ---------------------------------------------------------------------------
  // 0. Freno de coste. ANTES de tocar los modelos, que es lo caro.
  // ---------------------------------------------------------------------------
  if ((await contarIntentos()) >= TOPE_INTENTOS) {
    return res.status(429).json({
      error: "Demasiados intentos fallidos. Espera unos minutos o avisa a Recursos Humanos para que registre tu checada.",
      bloqueado: true,
    });
  }

  // ---------------------------------------------------------------------------
  // 1. Cotejo. Se hace ANTES de crear nada.
  // ---------------------------------------------------------------------------
  let verificado = null; // null = no se pudo comprobar. No es lo mismo que "no coincide".
  let score = null;

  const { data: rostro } = await supabase
    .from("rostros")
    .select("id, huella, rostro_fotos(huella)")
    .eq("empleado_id", quien.id)
    .eq("estado", "aprobado") // uno pendiente es una cara que nadie ha mirado todavía
    .maybeSingle();

  // ¿Se exige tener el rostro registrado para poder checar? (migración 044)
  //
  // Mientras esto está apagado, quien no tenga rostro aprobado checa sin cotejo. Es
  // obligatorio durante el despliegue —si se exigiera desde el minuto uno, el primer día no
  // ficharía nadie—, pero en cuanto la plantilla está registrada se convierte en la puerta
  // de salida evidente: basta con NO registrarse para que el cotejo no te aplique.
  if (!rostro) {
    const { data: ajustes } = await supabase
      .from("ajustes")
      .select("exigir_rostro")
      .maybeSingle();

    if (ajustes?.exigir_rostro) {
      // Se distingue "no te has registrado" de "estás esperando a RH": son problemas de
      // personas distintas, y decirle "regístrate" a quien ya se registró es hacerle dar
      // vueltas por una tarea que no es suya.
      const { data: pendiente } = await supabase
        .from("rostros")
        .select("estado")
        .eq("empleado_id", quien.id)
        .maybeSingle();

      const enRevision = pendiente?.estado === "pendiente";

      return res.status(403).json({
        error: enRevision
          ? "Tus fotos están en revisión. Recursos Humanos debe aprobarlas antes de que puedas checar."
          : "Antes de checar tienes que registrar tu rostro.",
        // La pantalla lo usa para llevarle directamente a 'Mi rostro' en vez de dejarle
        // buscando en el menú.
        requiereRostro: !enRevision,
        enRevision,
        bloqueado: true,
      });
    }
  }

  if (rostro && selfiePath) {
    const referencias = (rostro.rostro_fotos || []).map((f) => f.huella);
    if (!referencias.length && rostro.huella) referencias.push(rostro.huella);

    const { data: archivo } = await supabase.storage.from("asistencias").download(selfiePath);

    if (archivo && referencias.length) {
      let huella = null;
      try {
        huella = await calcularHuella(Buffer.from(await archivo.arrayBuffer()));
      } catch (error) {
        console.error("Error calculando la huella de la checada:", error);
      }

      if (huella) {
        // Se compara contra TODAS sus fotos de referencia y se toma el MEJOR parecido, no el
        // promedio. Es lo que hace que funcione con y sin lentes: basta con parecerse a una.
        const scores = referencias
          .map((ref) => similitud(huella, ref))
          .filter((s) => s !== null);

        if (scores.length) {
          score = Math.max(...scores);
          verificado = score >= UMBRAL_MISMA_PERSONA;
        }
      }
      // Si no se detectó cara en la foto, `verificado` sigue en null y se trata igual que un
      // fallo: cuenta como intento. No se declara "no coincide" —no es lo mismo que no
      // coincida a que no se pudiera mirar— pero tampoco se deja pasar sin más, o bastaría
      // con mandar una foto ilegible para saltarse el cotejo.
    }
  }

  // ---------------------------------------------------------------------------
  // 2. ¿Se bloquea?
  // ---------------------------------------------------------------------------
  const hayQueCotejar = !!rostro; // sin rostro aprobado no hay contra qué comparar
  const fallo = hayQueCotejar && verificado !== true;

  if (fallo) {
    await supabase.from("cotejo_intentos").insert({ empleado_id: quien.id, score });
    const intentos = (await contarIntentos()) || 1;

    // No hay checada. Ni ahora ni al décimo intento: rendirse tras N fallos sería una puerta
    // que al impostor solo le costaría empujar tres veces.
    return res.status(403).json({
      error:
        score === null
          ? "No se distingue tu cara en la foto. Ponte de frente, con buena luz, e inténtalo otra vez."
          : "No pudimos confirmar que eres tú. Mira de frente, con buena luz, e inténtalo otra vez.",
      // A partir de unos cuantos fallos se le deja de pedir que reintente y se le dice qué
      // hacer. Insistir a ciegas contra un sistema que no cede es lo que acaba en una
      // persona plantada en la puerta sin saber a quién acudir.
      aviso:
        intentos >= INTENTOS_ANTES_DE_AVISAR
          ? "No insistas más: avisa a Recursos Humanos para que registre tu entrada y te vuelva a tomar el rostro."
          : null,
      bloqueado: true,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Registrar. La hora, la geocerca y el resto de guardias los sigue poniendo la RPC.
  //    El empleado se lo pasa el SERVIDOR desde el JWT que acaba de verificar: el cliente
  //    no puede decir "soy otro".
  // ---------------------------------------------------------------------------
  const { data: fila, error: errorRpc } = await supabase.rpc("registrar_checada", {
    p_empleado_id: quien.id,
    p_tipo: tipo,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_precision: precision ?? null,
    p_selfie_path: selfiePath ?? null,
    p_device_id: deviceId ?? null,
  });

  if (errorRpc) {
    console.error("Error registrando la checada:", errorRpc);
    // La RPC lanza mensajes ya escritos para el usuario ("Ya registraste tu entrada hace
    // unos segundos", "Tu turno termina a las 18:00..."). Se respetan tal cual: dicen
    // exactamente qué pasó y qué hacer.
    return res.status(400).json({ error: errorRpc.message || "No se pudo registrar tu checada." });
  }

  const checada = Array.isArray(fila) ? fila[0] : fila;

  if (hayQueCotejar) {
    await supabase
      .from("asistencias")
      .update({ match_score: score, rostro_verificado: verificado })
      .eq("id", checada.id);

    // Los intentos fallidos NO se borran al acertar.
    //
    // Antes sí, "para que no arrastrara fallos viejos" — pero eso destruía exactamente la
    // evidencia que RH necesita: alguien intenta tres veces con una cara que no coincide, y
    // luego entra el titular; borrar los fallos hace desaparecer el rastro del intento de
    // suplantación. Y era innecesario: el contador solo mira los últimos 15 minutos, así que
    // los fallos viejos ya caducan solos.
  }

  // El score NO se le devuelve al empleado: saber exactamente cuánto se parece le daría a
  // quien quiera burlar el sistema una forma de ir probando hasta pasar el umbral.
  return res.status(200).json({
    checada: { ...checada, match_score: score, rostro_verificado: verificado },
    verificado,
  });
}
