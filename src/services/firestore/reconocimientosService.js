import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

const COLLECTION_NAME = "reconocimientos";

// Obtiene todos los reconocimientos
export const getReconocimientos = async () => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map((doc) => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener reconocimientos:", error);
    throw new Error("No se pudieron cargar los reconocimientos.");
  }
};

// Guarda un nuevo reconocimiento
export const addReconocimiento = async (reconocimientoData) => {
  try {
    const nuevoReconocimiento = {
      ...reconocimientoData,
      id: Date.now(),
      fecha: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoReconocimiento);
    return docRef.id;
  } catch (error) {
    console.error("Error guardando reconocimiento:", error);
    throw new Error("No se pudo guardar el reconocimiento en la base de datos.");
  }
};
