import { supabase } from "../../config/supabase";

// Candidatos que llegan desde la app de reclutamiento McDental Talent.
// La tabla candidatos_bolsa la escribe Talent (service_role); aquí solo se lee.
const mapCandidato = (row) => ({
  id: row.id,
  talentId: row.talent_candidato_id,
  nombre: row.nombre,
  vacante: row.vacante,
  ciudad: row.ciudad,
  telefono: row.telefono,
  email: row.email,
  score: row.score,
  semaforo: row.semaforo,
  estado: row.estado,
  escolaridad: row.escolaridad,
  experiencia: row.experiencia,
  disponibilidad: row.disponibilidad,
  expectativaSalarial: row.expectativa_salarial,
  notas: row.notas,
  aplicadoEn: row.aplicado_en,
  createdAt: row.created_at,
});

export const getCandidatosBolsa = async () => {
  const { data, error } = await supabase
    .from("candidatos_bolsa")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener la bolsa de trabajo:", error);
    throw new Error("No se pudieron cargar los candidatos.");
  }

  return data.map(mapCandidato);
};
