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

const post = async (endpoint, cuerpo) => {
  const token = await conSesion();
  const respuesta = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    // El servidor manda mensajes ya escritos para el usuario ("En una de las fotos no se ve
    // tu cara..."). Se respetan: dicen exactamente qué hacer a continuación.
    throw new Error(datos.error || "No se pudo completar la operación.");
  }
  return datos;
};

const mapRostro = (r) => ({
  empleadoId: r.empleado_id,
  estado: r.estado,
  motivoRechazo: r.motivo_rechazo,
  revisadoEn: r.revisado_en,
  registradoEn: r.created_at,
  venceEn: r.vence_en,
  // Derivado: la cara caduca a los 6 meses (la gente cambia y una referencia vieja acaba
  // rechazando a su propio dueño). Se calcula aquí una vez, no en cada pantalla.
  caducado: !!r.vence_en && new Date(r.vence_en) < new Date(),
  diasParaVencer: r.vence_en
    ? Math.ceil((new Date(r.vence_en) - new Date()) / 86400000)
    : null,
  fotos: (r.rostro_fotos || []).map((f) => f.selfie_path),
});

/** Todos los registros de rostro. Solo RH y admin (RLS de la migración 041). */
export const getRostros = async () => {
  try {
    // La huella NO se pide: son 128 números que identifican a una persona y la pantalla no
    // los necesita. Traerlos "porque están ahí" es exponerlos sin motivo.
    const { data, error } = await supabase
      .from("rostros")
      .select("empleado_id, estado, motivo_rechazo, revisado_en, created_at, vence_en, rostro_fotos(selfie_path)");
    if (error) throw error;
    return (data || []).map(mapRostro);
  } catch (error) {
    console.error("Error al obtener los rostros:", error);
    throw new Error("No se pudo cargar el estado de los rostros.", { cause: error });
  }
};

/** El registro del propio empleado (para saber si ya se registró y en qué estado está). */
export const getMiRostro = async (empleadoId) => {
  const { data, error } = await supabase
    .from("rostros")
    .select("empleado_id, estado, motivo_rechazo, revisado_en, created_at, vence_en")
    .eq("empleado_id", empleadoId)
    .maybeSingle();

  if (error) {
    console.error("Error al obtener mi rostro:", error);
    return null;
  }
  return data ? mapRostro(data) : null;
};

/**
 * Sube las fotos y registra el rostro.
 *
 * Si lo hace el propio empleado, queda PENDIENTE: no sirve para cotejar hasta que RH lo
 * mire y confirme que esa cara es la suya. Si lo hace RH (con la persona delante), queda
 * aprobado directamente.
 */
export const registrarRostro = async ({ empleadoId, fotos, consentimiento, usaLentes = false }) => {
  const rutas = [];

  for (let i = 0; i < fotos.length; i += 1) {
    // La carpeta DEBE ser el uuid del empleado: es lo que la policy de storage comprueba
    // para que nadie suba fotos a la carpeta de otro (migración 042).
    const ruta = `${empleadoId}/${Date.now()}-${i}.jpg`;

    // SIN upsert, y no es un detalle: con upsert, Storage necesita LEER la metadata del
    // objeto antes de escribirlo, y el empleado solo tiene permiso de INSERT en este bucket
    // (no de SELECT ni de UPDATE). El upload fallaba con un error de RLS que no dice eso.
    // Es exactamente la trampa que documenta la migración 022 — y aquí el upsert además
    // sobraba: la ruta lleva un timestamp, así que nunca colisiona.
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, fotos[i], { contentType: "image/jpeg" });

    if (error) {
      console.error("Error subiendo la foto de registro:", error);
      throw new Error("No se pudo subir una de las fotos.");
    }
    rutas.push(ruta);
  }

  return post("enrolar-rostro", { empleadoId, fotos: rutas, consentimiento, usaLentes });
};

/**
 * RH aprueba o rechaza un rostro pendiente.
 *
 * Aprobar NO es un trámite: es afirmar que esa cara es la de esa persona. Si se aprueba sin
 * mirar, el compañero que registró su propia cara en una cuenta ajena queda verificado por
 * el sistema, y el cotejo pasa de detectar el fraude a certificarlo.
 */
export const revisarRostro = ({ empleadoId, aprobar, motivo }) =>
  post("aprobar-rostro", { empleadoId, aprobar, motivo });

/** URL firmada para ver una foto de referencia (bucket privado). */
export const getSignedUrlRostro = async (ruta, expiresInSeconds = 300) => {
  if (!ruta) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, expiresInSeconds);
  if (error) {
    console.error("Error firmando la URL del rostro:", error);
    return null;
  }
  return data.signedUrl;
};
