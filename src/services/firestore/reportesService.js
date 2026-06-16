import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

const COLLECTION_NAME = "reportesConfidenciales";

// Obtiene todos los reportes confidenciales
export const getReportesConfidenciales = async () => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map((doc) => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener reportes confidenciales:", error);
    throw new Error("No se pudieron cargar los reportes confidenciales.");
  }
};

// Guarda un nuevo reporte confidencial
// Automáticamente asigna el estado nuevo y permisos de visibilidad para admin/psicologa
export const addReporteConfidencial = async (reporteData) => {
  try {
    const nuevoReporte = {
      ...reporteData,
      id: Date.now(),
      fecha: new Date().toISOString().slice(0, 10),
      estado: "nuevo",
      visiblePara: ["admin", "psicologa"],
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoReporte);
    return docRef.id;
  } catch (error) {
    console.error("Error guardando reporte confidencial:", error);
    throw new Error("No se pudo guardar el reporte confidencial en la base de datos.");
  }
};
