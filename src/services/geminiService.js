import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export const generateEmployeeAnalysis = async (employeeData) => {
  if (!genAI) {
    throw new Error("No se ha configurado la clave de Gemini API (VITE_GEMINI_API_KEY).");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
Eres un Psicólogo Organizacional y Experto en Recursos Humanos.
Tu tarea es analizar el historial reciente de un colaborador y redactar un informe clínico/operativo confidencial con recomendaciones de acción para RRHH y la gerencia.

Aquí están los datos del colaborador (anonimizados o resumidos para privacidad):
Nombre: ${employeeData.nombre}
Puesto: ${employeeData.puesto}
Sucursal: ${employeeData.sucursal}
Antigüedad aprox: ${employeeData.antiguedad}
Último Pulse Score (Semana actual o reciente): ${employeeData.pulseScore || "Sin datos"}
Scores Históricos Recientes: ${employeeData.scoresHistoricos.join(" -> ")}
Riesgos detectados por el sistema base: ${employeeData.riesgosBase.join(", ") || "Ninguno"}
Notas Clínicas de la Psicóloga: ${employeeData.notasClinicas.length > 0 ? employeeData.notasClinicas.join(" | ") : "Sin notas clínicas recientes."}
Permisos recientes: ${employeeData.permisosCount}
Descuentos recientes: ${employeeData.descuentosCount}
Reconocimientos recientes: ${employeeData.reconocimientosCount}

Por favor, genera un análisis profesional, empático y estructurado en las siguientes tres secciones (formateadas en Markdown básico sin usar encabezados de nivel 1 o 2, usa negritas para separar):

1. **Diagnóstico del Colaborador:** (Un párrafo breve evaluando el estado general de bienestar, motivación o riesgo de rotación/burnout, basándote en cómo se entrelazan sus scores, notas, permisos y faltas de reconocimiento).
2. **Factores Críticos:** (Una lista de 1 a 3 puntos con lo más preocupante o lo más positivo que observas).
3. **Plan de Acción Recomendado:** (3 pasos precisos y accionables para RRHH, el jefe directo o la psicóloga).

Usa un tono profesional, objetivo, empático y directo. No inventes datos, usa solo la información proporcionada. Si hay "Sin datos", mencionalo adecuadamente.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating Gemini analysis:", error);
    throw new Error("Ocurrió un error al contactar a la inteligencia artificial de Gemini.");
  }
};

export const callGemini = async (prompt) => {
  if (!genAI) {
    throw new Error("No se ha configurado la clave de Gemini API (VITE_GEMINI_API_KEY).");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating Gemini response:", error);
    throw new Error("Ocurrió un error al contactar a la inteligencia artificial de Gemini.");
  }
};
