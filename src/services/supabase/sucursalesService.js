import { supabase } from "../../config/supabase";
import { fetchAll } from "./fetchAll";

const mapSucursal = (row) => ({
  id: row.id,
  nombre: row.nombre,
  lat: row.lat === null ? null : Number(row.lat),
  lng: row.lng === null ? null : Number(row.lng),
  radioM: row.radio_m,
  activa: row.activa,
  // Derivado, para que la UI no tenga que repetir la condición en cada sitio.
  tieneGeocerca: row.lat !== null && row.lng !== null,
});

export const getSucursales = async () => {
  try {
    const rows = await fetchAll(() =>
      supabase.from("sucursales").select("*").order("nombre", { ascending: true })
    );
    return rows.map(mapSucursal);
  } catch (error) {
    console.error("Error al obtener sucursales:", error);
    throw new Error("No se pudieron cargar las sucursales.", { cause: error });
  }
};

/**
 * Da de alta una sucursal nueva. Solo el nombre: la geocerca se captura después, estando en la
 * clínica ("Usar mi ubicación actual"). Nace activa y sin coordenadas — sus checadas se registran
 * igual (marcadas 'sin_geocerca'), como cualquier clínica todavía sin ubicación. RLS permite el
 * insert solo a gestión (admin/rh/psicologa).
 */
export const crearSucursal = async ({ nombre }) => {
  const limpio = (nombre || "").trim();
  if (!limpio) throw new Error("Escribe el nombre de la sucursal.");

  const { data, error } = await supabase
    .from("sucursales")
    .insert({ nombre: limpio })
    .select()
    .single();

  if (error) {
    // 23505 = nombre duplicado (índice único). Mensaje claro en vez del error crudo de Postgres.
    if (error.code === "23505") throw new Error("Ya existe una sucursal con ese nombre.");
    console.error("Error creando la sucursal:", error);
    throw new Error("No se pudo crear la sucursal.");
  }
  return mapSucursal(data);
};

/**
 * Fija la geocerca de una clínica.
 *
 * Las coordenadas se capturan estando físicamente en la clínica ("Usar mi ubicación
 * actual"), no sacándolas de un mapa: una geocerca puesta a ojo desde una vista aérea
 * acaba rechazando a quien sí está en su sitio, y ese error se paga en llamadas a RH a
 * las ocho de la mañana.
 *
 * Pasar lat/lng en null desactiva la geocerca: las checadas siguen registrándose, pero
 * marcadas como 'sin_geocerca'. Es una salida de emergencia legítima si una clínica se
 * muda y sus coordenadas dejan de valer.
 */
export const updateGeocercaSucursal = async ({ id, lat, lng, radioM }) => {
  const { data, error } = await supabase
    .from("sucursales")
    .update({
      lat: lat ?? null,
      lng: lng ?? null,
      radio_m: radioM ?? 150,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error guardando la geocerca:", error);
    throw new Error("No se pudo guardar la ubicación de la sucursal.");
  }
  return mapSucursal(data);
};
