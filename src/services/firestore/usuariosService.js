import { collection, getDocs, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

const COLLECTION_NAME = "usuariosPassword";

// Obtiene todos los registros de contraseñas
export const getUsuariosPassword = async () => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener usuariosPassword:", error);
    throw new Error("No se pudieron cargar las credenciales.");
  }
};

// Inicializa los usuarios en Firestore basándose en el array estático, crea un registro en usuariosPassword para los que no lo tengan
export const inicializarUsuariosPassword = async (usuariosBase, usuariosPasswordActual) => {
  try {
    for (const empleado of usuariosBase) {
      const existe = usuariosPasswordActual.find((u) => u.userId === empleado.id);

      if (!existe) {
        await addDoc(collection(db, COLLECTION_NAME), {
          userId: empleado.id,
          usuario: empleado.user,
          password: empleado.pass,
          debeCambiarPassword: true,
          creadoEn: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error("Error inicializando usuariosPassword:", error);
    throw new Error("Error al inicializar usuarios de contraseña.");
  }
};

// Cambia la contraseña del usuario actual
export const cambiarPassword = async (docId, nuevaPassword) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, docId);
    await updateDoc(userRef, {
      password: nuevaPassword,
      debeCambiarPassword: false,
      actualizadoEn: serverTimestamp()
    });
  } catch (error) {
    console.error("Error cambiando contraseña:", error);
    throw new Error("Error al cambiar la contraseña.");
  }
};

// Restablece la contraseña de un empleado a "emp123"
export const restablecerPassword = async (docId, restablecidoPor) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, docId);
    await updateDoc(userRef, {
      password: "emp123",
      debeCambiarPassword: true,
      restablecidoEn: serverTimestamp(),
      restablecidoPor: restablecidoPor || "Sistema"
    });
  } catch (error) {
    console.error("Error restableciendo contraseña:", error);
    throw new Error("Error al restablecer contraseña.");
  }
};
