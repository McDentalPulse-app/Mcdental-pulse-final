import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { preguntaToFirestore } from "../../utils/encuestaPreguntas";

const COLLECTION_NAME = "encuesta_preguntas";

export const saveEncuestaPreguntas = async (preguntas) => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const existing = snapshot.docs.map((d) => ({
      firebaseId: d.id,
      ...d.data(),
    }));

    const updated = [];

    for (const pregunta of preguntas) {
      const payload = {
        ...preguntaToFirestore(pregunta),
        actualizadoEn: serverTimestamp(),
      };

      const match =
        (pregunta.firebaseId &&
          existing.find((e) => e.firebaseId === pregunta.firebaseId)) ||
        existing.find((e) => Number(e.id) === Number(pregunta.id));

      if (match?.firebaseId) {
        await updateDoc(doc(db, COLLECTION_NAME, match.firebaseId), payload);
        updated.push({ ...pregunta, firebaseId: match.firebaseId });
      } else {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
          ...payload,
          creadoEn: serverTimestamp(),
        });
        updated.push({ ...pregunta, firebaseId: docRef.id });
      }
    }

    return updated;
  } catch (error) {
    console.error("Error al guardar preguntas de encuesta:", error);
    throw new Error(
      error?.message || "No se pudieron guardar las preguntas en Firebase."
    );
  }
};
