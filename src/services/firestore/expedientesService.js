import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

const ARCHIVOS_COLLECTION = "archivosExpediente";
const VACACIONES_COLLECTION = "vacaciones";
const PERMISOS_COLLECTION = "permisos";
const DESCUENTOS_COLLECTION = "descuentos";

// Obtiene todos los archivos del expediente
export const getArchivosExpediente = async () => {
  try {
    const snapshot = await getDocs(collection(db, ARCHIVOS_COLLECTION));
    return snapshot.docs.map((doc) => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener archivos de expediente:", error);
    throw new Error("No se pudieron cargar los archivos del expediente.");
  }
};

export const addArchivoExpediente = async (archivoData) => {
  try {
    const nuevoArchivo = {
      ...archivoData,
      id: Date.now(),
      fecha: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, ARCHIVOS_COLLECTION), nuevoArchivo);
    return docRef.id;
  } catch (error) {
    console.error("Error subiendo archivo de expediente:", error);
    throw new Error("No se pudo subir el archivo.");
  }
};

// Obtiene todas las vacaciones
export const getVacaciones = async () => {
  try {
    const snapshot = await getDocs(collection(db, VACACIONES_COLLECTION));
    return snapshot.docs.map((doc) => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener vacaciones:", error);
    throw new Error("No se pudieron cargar las vacaciones.");
  }
};

export const addVacacion = async (vacacionData) => {
  try {
    const nuevaVacacion = {
      ...vacacionData,
      id: Date.now(),
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, VACACIONES_COLLECTION), nuevaVacacion);
    return docRef.id;
  } catch (error) {
    console.error("Error solicitando vacaciones:", error);
    throw new Error("No se pudo registrar la solicitud de vacaciones.");
  }
};

export const updateEstadoVacacion = async (firebaseId, nuevoEstado) => {
  try {
    const docRef = doc(db, VACACIONES_COLLECTION, firebaseId);
    await updateDoc(docRef, {
      estado: nuevoEstado,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error actualizando vacaciones:", error);
    throw new Error("No se pudo actualizar el estado de las vacaciones.");
  }
};

// Obtiene todos los permisos
export const getPermisos = async () => {
  try {
    const snapshot = await getDocs(collection(db, PERMISOS_COLLECTION));
    return snapshot.docs.map((doc) => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    throw new Error("No se pudieron cargar los permisos.");
  }
};

export const addPermiso = async (permisoData) => {
  try {
    const nuevoPermiso = {
      ...permisoData,
      id: Date.now(),
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, PERMISOS_COLLECTION), nuevoPermiso);
    return docRef.id;
  } catch (error) {
    console.error("Error solicitando permiso:", error);
    throw new Error("No se pudo registrar la solicitud de permiso.");
  }
};

export const updateEstadoPermiso = async (firebaseId, nuevoEstado) => {
  try {
    const docRef = doc(db, PERMISOS_COLLECTION, firebaseId);
    await updateDoc(docRef, {
      estado: nuevoEstado,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error actualizando permiso:", error);
    throw new Error("No se pudo actualizar el estado del permiso.");
  }
};

// Obtiene todos los descuentos
export const getDescuentos = async () => {
  try {
    const snapshot = await getDocs(collection(db, DESCUENTOS_COLLECTION));
    return snapshot.docs.map((doc) => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener descuentos:", error);
    throw new Error("No se pudieron cargar los descuentos.");
  }
};

export const addDescuento = async (descuentoData) => {
  try {
    const nuevoDescuento = {
      ...descuentoData,
      id: Date.now(),
      fechaCreacion: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, DESCUENTOS_COLLECTION), nuevoDescuento);
    return docRef.id;
  } catch (error) {
    console.error("Error registrando descuento:", error);
    throw new Error("No se pudo registrar el descuento.");
  }
};

export const updateDescuento = async (firebaseId, updates) => {
  try {
    const docRef = doc(db, DESCUENTOS_COLLECTION, firebaseId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error actualizando descuento:", error);
    throw new Error("No se pudo actualizar el descuento.");
  }
};
