import { supabase } from "../../config/supabase";

const BUCKET = "rostros";

/**
 * Cotejo facial, lado cliente.
 *
 * Fíjate en lo que este archivo NO hace: no calcula ninguna huella, no compara nada y no
 * ve ni un número. Solo sube fotos y pide al servidor que haga el trabajo. Es a propósito:
 * si el parecido se calculara aquí, cualquiera podría mandar un 99% desde la consola del
 * navegador y el cotejo entero sería teatro.
 */

const conSesion = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");
  return token;
};

/** Quién está enrolado. Solo lo pueden leer RH y admin (RLS de la migración 041). */
export const getRostros = async () => {
  try {
    // La huella NO se pide: son 128 números que identifican a una persona y la pantalla no
    // los necesita para nada. Traerlos "porque están ahí" es exponerlos sin motivo.
    const { data, error } = await supabase
      .from("rostros")
      .select("empleado_id, consentimiento_en, created_at");
    if (error) throw error;

    return (data || []).map((r) => ({
      empleadoId: r.empleado_id,
      consentimientoEn: r.consentimiento_en,
      enroladoEn: r.created_at,
    }));
  } catch (error) {
    console.error("Error al obtener los rostros enrolados:", error);
    throw new Error("No se pudo cargar el estado de enrolado.", { cause: error });
  }
};

/**
 * Enrola la cara de referencia de un empleado. Solo RH/admin, y presencialmente.
 *
 * La foto se sube al bucket privado y el servidor calcula la huella a partir de ella. El
 * consentimiento viaja como una afirmación explícita: sin él, el servidor rechaza (y la
 * columna consentimiento_en es NOT NULL, así que tampoco habría cómo guardarlo).
 */
export const enrolarRostro = async ({ empleadoId, foto, consentimiento }) => {
  const token = await conSesion();

  const ruta = `${empleadoId}.jpg`;
  const { error: errorUpload } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, foto, { contentType: "image/jpeg", upsert: true });

  if (errorUpload) {
    console.error("Error subiendo la foto de enrolado:", errorUpload);
    throw new Error("No se pudo subir la foto.");
  }

  const respuesta = await fetch("/api/enrolar-rostro", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ empleadoId, selfiePath: ruta, consentimiento }),
  });

  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    // El servidor manda mensajes ya escritos para el usuario ("No se detecta una cara en la
    // foto..."). Se respetan: dicen exactamente qué hacer a continuación.
    throw new Error(cuerpo.error || "No se pudo enrolar el rostro.");
  }
  return cuerpo;
};

/**
 * Pide el cotejo de una checada recién registrada.
 *
 * Se llama sin esperar el resultado (el empleado ya fichó; no se le hace aguardar a que un
 * modelo termine). Si esta llamada nunca ocurre —red caída, o alguien que la evita a
 * propósito— la checada se queda SIN VERIFICAR, y eso también aparece marcado en el panel
 * de RH. Saltárselo no ayuda a nadie.
 */
export const verificarChecada = async (checadaId) => {
  try {
    const token = await conSesion();
    await fetch("/api/verificar-rostro", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ checadaId }),
    });
  } catch (error) {
    // Nunca se le enseña al empleado: su checada ya está registrada y el cotejo es asunto
    // del sistema, no suyo. Molestarle con un error que no puede arreglar solo erosiona la
    // confianza en una pantalla que tiene que usar dos veces al día.
    console.warn("No se pudo cotejar el rostro de la checada:", error);
  }
};
