import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

// Departamentos del ORGANIGRAMA (mig. 153) — distinto de public.departamentos (mig. 133-134,
// el módulo estilo Teams). El archivo de responsabilidades vive en la misma fila.
const mapArea = (row) =>
  row && {
    id: row.id,
    nombre: row.nombre,
    orden: row.orden,
    color: row.color,
    archivoNombre: row.archivo_nombre,
    archivoRuta: row.archivo_ruta,
    archivoSubidoPor: row.archivo_subido_por,
    archivoSubidoEn: row.archivo_subido_en,
  };

// Para todos los roles (RLS: cualquier autenticado lee) — igual que sucursales.
export const getAreas = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("areas").select("*").order("orden", { ascending: true })
    );
    return rows.map(mapArea);
  } catch (error) {
    console.error("Error al obtener áreas:", error);
    throw new Error("No se pudieron cargar los departamentos.", { cause: error });
  }
};

// Crear o renombrar un departamento. Reservado a admin/admin_plus/rh por RLS
// (areas_write_gestion, mig. 153).
export const guardarArea = async ({ id, nombre, orden, color }) => {
  const payload = {};
  if (nombre !== undefined) payload.nombre = nombre;
  if (orden !== undefined) payload.orden = orden;
  if (color !== undefined) payload.color = color;

  const query = id
    ? supabase.from("areas").update(payload).eq("id", id)
    : supabase.from("areas").insert(payload);

  const { data, error } = await query.select().single();
  if (error) {
    console.error("Error guardando área:", error);
    throw new Error(
      error.message?.includes("duplicate")
        ? "Ya existe un departamento con ese nombre."
        : "No se pudo guardar el departamento."
    );
  }
  return mapArea(data);
};

export const eliminarArea = async (id) => {
  const { error } = await supabase.from("areas").delete().eq("id", id);
  if (error) {
    console.error("Error borrando área:", error);
    throw new Error("No se pudo borrar el departamento.");
  }
  return true;
};
