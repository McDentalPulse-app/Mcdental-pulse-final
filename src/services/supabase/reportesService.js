import { supabase } from "../../config/supabase";

const mapReporte = (row) => ({
  id: row.id,
  empleadoId: row.empleado_id,
  tipo: row.tipo,
  urgencia: row.urgencia,
  descripcion: row.descripcion,
  evidencias: row.evidencias,
  estado: row.estado,
  fecha: row.fecha,
});

export const getReportesConfidenciales = async () => {
  const { data, error } = await supabase.from("reportes_confidenciales").select("*");
  if (error) {
    console.error("Error al obtener reportes confidenciales:", error);
    throw new Error("No se pudieron cargar los reportes confidenciales.");
  }
  return data.map(mapReporte);
};

// La visibilidad (antes hardcodeada como visiblePara: ["admin","psicologa"]) ahora la resuelve RLS.
export const addReporteConfidencial = async ({ empleadoId, tipo, urgencia, descripcion, evidencias }) => {
  const { data, error } = await supabase
    .from("reportes_confidenciales")
    .insert({ empleado_id: empleadoId, tipo, urgencia, descripcion, evidencias })
    .select()
    .single();

  if (error) {
    console.error("Error guardando reporte confidencial:", error);
    throw new Error("No se pudo guardar el reporte confidencial.");
  }
  return mapReporte(data);
};
