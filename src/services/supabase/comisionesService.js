import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";
import { comprimirImagen } from "../../utils/imagen";

const BUCKET = "comisiones";
const MAX_DIMENSION = 1400; // un recibo tiene texto: se conserva más resolución que un avatar
const SELECT_CON_DOCTOR = "*, usuarios:doctor_id(name, sucursal, puesto)";

const mapComision = (row) => ({
  id: row.id,
  doctorId: row.doctor_id,
  doctor: row.usuarios?.name,
  sucursal: row.usuarios?.sucursal,
  puesto: row.usuarios?.puesto,
  fotoPath: row.foto_path,
  fecha: row.fecha,
  nota: row.nota,
  estado: row.estado,
  comentarioRH: row.comentario_rh,
  revisadoPor: row.revisado_por,
  revisadoEn: row.revisado_en,
  createdAt: row.created_at,
});

// RLS hace el filtrado: el doctor recibe solo las suyas; gestión, todas.
export const getComisiones = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("comisiones").select(SELECT_CON_DOCTOR).order("created_at", { ascending: false }),
    );
    return rows.map(mapComision);
  } catch (error) {
    console.error("Error al obtener comisiones:", error);
    throw new Error("No se pudieron cargar las comisiones.", { cause: error });
  }
};

// El bucket es privado (dato económico): la foto se lee con una URL firmada de vida corta.
export const getSignedUrlComision = async (fotoPath, expiresInSeconds = 300) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(fotoPath, expiresInSeconds);
  if (error) {
    console.error("Error firmando URL de comisión:", error);
    throw new Error("No se pudo abrir la foto del recibo.");
  }
  return data.signedUrl;
};

export const crearComision = async ({ doctorId, archivo, nota }) => {
  if (!archivo?.type?.startsWith("image/")) {
    throw new Error("Selecciona o toma una foto del recibo.");
  }

  // Comprime en el navegador antes de subir (el bucket tiene tope server-side de 3MB).
  const blob = await comprimirImagen(archivo, MAX_DIMENSION);
  const ruta = `${doctorId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blob, { upsert: false, contentType: "image/jpeg" });
  if (uploadError) {
    console.error("Error subiendo recibo:", uploadError);
    throw new Error("No se pudo subir la foto del recibo.");
  }

  const { data, error } = await supabase
    .from("comisiones")
    .insert({ doctor_id: doctorId, foto_path: ruta, nota: nota?.trim() || null })
    .select(SELECT_CON_DOCTOR)
    .single();

  if (error) {
    // Deja huérfano el objeto si el insert falla; lo limpiamos para no acumular basura.
    await supabase.storage.from(BUCKET).remove([ruta]).catch(() => {});
    console.error("Error registrando comisión:", error);
    throw new Error("No se pudo registrar el recibo.");
  }
  return mapComision(data);
};

/**
 * RH valida/rechaza. Pasa por el SERVIDOR (api/revisar-comision.js), no por un update directo:
 * es lo que permite mandarle el mensaje + push al doctor con la clave privada de VAPID.
 */
export const revisarComision = async (id, estado, comentario = "") => {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a entrar.");

  const r = await fetch("/api/revisar-comision", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ comisionId: id, estado, comentario }),
  });

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("Error revisando comisión:", cuerpo.error);
    throw new Error(cuerpo.error || "No se pudo actualizar la comisión.");
  }
  return mapComision(cuerpo.comision);
};
