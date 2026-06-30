import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

const COLLECTION_NAME = "mensajes";

// Obtiene todos los mensajes
export const getMensajes = async () => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map((doc) => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    throw new Error("No se pudieron cargar los mensajes.");
  }
};

// Guarda un nuevo mensaje
export const sendMensaje = async (mensajeData) => {
  try {
    const nuevoMensaje = {
      ...mensajeData,
      id: Date.now(),
      fecha: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoMensaje);
    return docRef.id;
  } catch (error) {
    console.error("Error guardando mensaje:", error);
    throw new Error("No se pudo enviar el mensaje.");
  }
};
