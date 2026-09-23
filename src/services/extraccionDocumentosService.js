import { supabase } from "../config/supabase";

/** Blob -> base64 puro (sin el prefijo "data:mime;base64,"). */
const blobABase64 = (blob) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(",")[1] || "");
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.readAsDataURL(blob);
  });

/**
 * Manda hasta 4 documentos (INE, CURP, RFC, comprobante) al proxy de Gemini Vision
 * (api/extraer-datos-documento.js) y regresa lo que la IA pudo leer: nombre, CURP, RFC,
 * fecha de nacimiento, sexo, estado civil, nacionalidad y domicilio. Cualquier campo que la
 * IA no pudo leer con certeza llega en null — GenerarContratoModal.jsx decide qué hacer con
 * eso, este servicio no rellena nada por su cuenta.
 *
 * `archivos`: [{ blob, mimeType }].
 */
export const extraerDatosDocumentos = async (archivos) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sesión no válida. Vuelve a iniciar sesión.");

  const payload = await Promise.all(
    archivos.map(async ({ blob, mimeType }) => ({ base64: await blobABase64(blob), mimeType }))
  );

  const res = await fetch("/api/extraer-datos-documento", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ archivos: payload }),
  });

  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(cuerpo.error || "No se pudieron extraer los datos de los documentos.");
  }
  return cuerpo.datos;
};
