import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

const COLLECTION_NAME = "encuestas";

// Obtiene todas las encuestas guardadas
export const getEncuestas = async () => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map((doc) => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener encuestas:", error);
    throw new Error("No se pudieron cargar las encuestas.");
  }
};

// Guarda una nueva encuesta
export const addEncuesta = async (encuestaData) => {
  try {
    const nuevaEncuesta = {
      ...encuestaData,
      id: Date.now(),
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaEncuesta);
    return docRef.id;
  } catch (error) {
    console.error("Error guardando encuesta:", error);
    throw new Error("No se pudo guardar la encuesta en la base de datos.");
  }
};