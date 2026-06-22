import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { notify } from "../utils/notify";
import { useGlobal } from "../contexts/GlobalContext";
import { useAuth } from "../contexts/AuthContext";


export const useAppActions = () => {
  const { usuarios: USERS } = useGlobal();

  const { user } = useAuth();
  const {
    vacaciones, setVacaciones,
    permisos, setPermisos,
    descuentos, setDescuentos,
    encuestas, setEncuestas,
    mensajes, setMensajes,
    notas, setNotas,
    reportesConfidenciales, setReportesConfidenciales,
    reconocimientos, setReconocimientos,
    archivosExpediente, setArchivosExpediente,
  } = useGlobal();

  const addEncuesta = async (enc) => {
    const nuevaEncuesta = {
      ...enc,
      id: Date.now(),
      createdAt: serverTimestamp()
    };

    setEncuestas(prev => [...prev, nuevaEncuesta]);

    try {
      const docRef = await addDoc(collection(db, "encuestas"), nuevaEncuesta);
      setEncuestas(prev => prev.map(e => e.id === nuevaEncuesta.id ? { ...e, firebaseId: docRef.id } : e));
    } catch (error) {
      console.error("Error guardando encuesta:", error);
      notify.toast.error("La encuesta se guardó en la app, pero no se pudo guardar en Firebase.");
    }
  };

  const sendMensaje = async (msg) => {
    const nuevoMensaje = {
      ...msg,
      id: Date.now(),
      fecha: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp()
    };

    setMensajes(prev => [...prev, nuevoMensaje]);

    try {
      const docRef = await addDoc(collection(db, "mensajes"), nuevoMensaje);
      setMensajes(prev => prev.map(m => m.id === nuevoMensaje.id ? { ...m, firebaseId: docRef.id } : m));
    } catch (error) {
      console.error("Error guardando mensaje:", error);
      notify.toast.error("El mensaje se guardó en la app, pero no se pudo guardar en Firebase.");
    }
  };

  const addNota = async (empleadoId, texto) => {
    if (!texto.trim()) return;

    const nuevaNota = {
      id: Date.now(),
      empleadoId,
      texto,
      fecha: new Date().toISOString().slice(0, 10),
      autor: user?.name || "Dra. Laura Vega",
      autorId: user?.id || null,
      createdAt: serverTimestamp()
    };

    setNotas(prev => [...prev, nuevaNota]);

    try {
      const docRef = await addDoc(collection(db, "notasPsicologicas"), nuevaNota);
      setNotas(prev => prev.map(n => n.id === nuevaNota.id ? { ...n, firebaseId: docRef.id } : n));
    } catch (error) {
      console.error("Error guardando nota psicológica:", error);
      notify.toast.error("La nota se guardó en la app, pero no se pudo guardar en Firebase.");
    }
  };

  const updateVacacionEstado = async (id, estado, comentarioRH = "") => {
    const vacacionAntes = vacaciones.find(v => v.id === id);
    setVacaciones(prev => prev.map(v => v.id === id ? { ...v, estado, comentarioRH } : v));

    try {
      let firebaseId = vacacionAntes?.firebaseId;
      if (!firebaseId) {
        const snapshot = await getDocs(collection(db, "vacaciones"));
        const encontrado = snapshot.docs.find((docItem) => docItem.data().id === id);
        firebaseId = encontrado?.id;
      }

      if (firebaseId) {
        await updateDoc(doc(db, "vacaciones", firebaseId), { estado, comentarioRH });
      }
    } catch (error) {
      console.error("Error actualizando vacación en Firebase:", error);
      notify.toast.error("La vacación se actualizó en la app, pero no se pudo actualizar en Firebase.");
    }
  };

  const updatePermisoEstado = async (id, estado, comentarioRH = "") => {
    const permisoAntes = permisos.find(p => p.id === id);
    setPermisos(prev => prev.map(p => p.id === id ? { ...p, estado, comentarioRH } : p));

    try {
      let firebaseId = permisoAntes?.firebaseId;
      if (!firebaseId) {
        const snapshot = await getDocs(collection(db, "permisos"));
        const encontrado = snapshot.docs.find((docItem) => docItem.data().id === id);
        firebaseId = encontrado?.id;
      }

      if (firebaseId) {
        await updateDoc(doc(db, "permisos", firebaseId), { estado, comentarioRH });
      }
    } catch (error) {
      console.error("Error actualizando permiso en Firebase:", error);
      notify.toast.error("El permiso se actualizó en la app, pero no se pudo actualizar en Firebase.");
    }
  };

  const addSolicitudEmpleadoRH = async (solicitud) => {
    const empleadoDemo = USERS.find(u => u.id === solicitud.empleadoId) || {};
    const nombreEmpleado = solicitud.nombre || solicitud.empleado || empleadoDemo.name || "Empleado";
    const sucursalEmpleado = solicitud.sucursal || empleadoDemo.sucursal || "Sin sucursal";
    const puestoEmpleado = solicitud.puesto || solicitud.categoria || empleadoDemo.puesto || empleadoDemo.categoria || "Empleado";

    if (solicitud.tipo === "Vacaciones") {
      const nuevaVacacion = {
        id: solicitud.id || Date.now(),
        empleadoId: solicitud.empleadoId,
        nombre: nombreEmpleado,
        empleado: nombreEmpleado,
        sucursal: sucursalEmpleado,
        puesto: puestoEmpleado,
        categoria: puestoEmpleado,
        fechaInicio: solicitud.fechaInicio,
        fechaFin: solicitud.fechaFin,
        inicio: solicitud.fechaInicio,
        fin: solicitud.fechaFin,
        desde: solicitud.fechaInicio,
        hasta: solicitud.fechaFin,
        dias: solicitud.dias || 1,
        motivo: solicitud.motivo,
        comentario: solicitud.comentario || "",
        comentarioRH: "",
        estado: "pendiente",
        origen: "empleado",
        createdAt: serverTimestamp()
      };

      setVacaciones((prev) => [nuevaVacacion, ...prev]);

      try {
        const docRef = await addDoc(collection(db, "vacaciones"), nuevaVacacion);
        setVacaciones((prev) => prev.map((v) => v.id === nuevaVacacion.id ? { ...v, firebaseId: docRef.id } : v));
      } catch (error) {
        console.error("Error guardando vacación:", error);
        notify.toast.error("La solicitud se guardó en la app, pero no se pudo guardar en Firebase.");
      }
      return;
    }

    if (solicitud.tipo === "Permisos") {
      const nuevoPermiso = {
        id: solicitud.id || Date.now(),
        empleadoId: solicitud.empleadoId,
        nombre: nombreEmpleado,
        empleado: nombreEmpleado,
        sucursal: sucursalEmpleado,
        puesto: puestoEmpleado,
        categoria: puestoEmpleado,
        fecha: solicitud.fechaInicio || solicitud.fecha,
        hora: solicitud.hora,
        motivo: solicitud.motivo,
        comentario: solicitud.comentario || "",
        comentarioRH: "",
        estado: "pendiente",
        origen: "empleado",
        createdAt: serverTimestamp()
      };

      setPermisos((prev) => [nuevoPermiso, ...prev]);

      try {
        const docRef = await addDoc(collection(db, "permisos"), nuevoPermiso);
        setPermisos((prev) => prev.map((p) => p.id === nuevoPermiso.id ? { ...p, firebaseId: docRef.id } : p));
      } catch (error) {
        console.error("Error guardando permiso:", error);
        notify.toast.error("La solicitud se guardó en la app, pero no se pudo guardar en Firebase.");
      }
    }
  };

  const updateDescuentoEstado = async (id, estado) => {
    const descuentoAntes = descuentos.find(d => d.id === id);
    const descuentoActualizado = { ...descuentoAntes, estado, updatedAt: serverTimestamp() };

    setDescuentos(prev => prev.map(d => d.id === id ? { ...d, estado } : d));

    try {
      let firebaseId = descuentoAntes?.firebaseId;
      if (firebaseId) {
        await updateDoc(doc(db, "descuentos", firebaseId), { estado, updatedAt: serverTimestamp() });
        return;
      }

      const docRef = await addDoc(collection(db, "descuentos"), {
        ...descuentoActualizado,
        createdAt: serverTimestamp()
      });
      setDescuentos(prev => prev.map(d => d.id === id ? { ...d, firebaseId: docRef.id } : d));
    } catch (error) {
      console.error("Error actualizando descuento en Firebase:", error);
      notify.toast.error("El descuento se actualizó localmente, pero no en Firebase.");
    }
  };

  const addDescuento = async (descuento) => {
    const nuevoDescuento = {
      ...descuento,
      id: Date.now(),
      estado: "pendiente",
      autor: user?.name || "Administración",
      createdAt: serverTimestamp()
    };

    setDescuentos(prev => [...prev, nuevoDescuento]);

    try {
      const docRef = await addDoc(collection(db, "descuentos"), nuevoDescuento);
      setDescuentos(prev => prev.map(d => d.id === nuevoDescuento.id ? { ...d, firebaseId: docRef.id } : d));
    } catch (error) {
      console.error("Error guardando descuento:", error);
      notify.toast.error("El descuento se guardó localmente, pero no en Firebase.");
    }
  };

  const addReporteConfidencial = async (reporte) => {
    const nuevoReporte = {
      ...reporte,
      id: Date.now(),
      fechaReporte: new Date().toISOString(),
      estado: "nuevo",
      createdAt: serverTimestamp()
    };

    setReportesConfidenciales(prev => [...prev, nuevoReporte]);

    try {
      const docRef = await addDoc(collection(db, "reportesConfidenciales"), nuevoReporte);
      setReportesConfidenciales(prev => prev.map(r => r.id === nuevoReporte.id ? { ...r, firebaseId: docRef.id } : r));
    } catch (error) {
      console.error("Error enviando reporte confidencial:", error);
      notify.toast.error("El reporte se guardó localmente, pero no en Firebase.");
    }
  };

  const addReconocimiento = async (rec) => {
    const nuevoRec = {
      ...rec,
      id: Date.now(),
      fecha: new Date().toISOString().slice(0, 10),
      autor: user?.name || "Recursos Humanos",
      createdAt: serverTimestamp()
    };

    setReconocimientos(prev => [...prev, nuevoRec]);

    try {
      const docRef = await addDoc(collection(db, "reconocimientos"), nuevoRec);
      setReconocimientos(prev => prev.map(r => r.id === nuevoRec.id ? { ...r, firebaseId: docRef.id } : r));
    } catch (error) {
      console.error("Error enviando reconocimiento:", error);
      notify.toast.error("El reconocimiento se guardó localmente, pero no en Firebase.");
    }
  };

  const subirArchivoExpediente = async ({ empleado, archivo, tipo }) => {
    if (!empleado || !archivo) {
      notify.toast.warning("Selecciona empleado y archivo.");
      return;
    }

    // Límite de 10 MB
    if (archivo.size > 10 * 1024 * 1024) {
      notify.toast.warning("El archivo excede el límite de 10 MB permitido.");
      return;
    }

    try {
      const rutaArchivo = `expedientes/${empleado.id}/${Date.now()}-${archivo.name}`;
      const archivoRef = ref(storage, rutaArchivo);
      await uploadBytes(archivoRef, archivo);
      const url = await getDownloadURL(archivoRef);

      const nuevoArchivo = {
        id: Date.now(),
        empleadoId: empleado.id,
        empleado: empleado.name,
        sucursal: empleado.sucursal || "Sin sucursal",
        puesto: empleado.puesto || empleado.categoria || "Empleado",
        nombreArchivo: archivo.name,
        tipoArchivo: tipo || "General",
        url,
        rutaArchivo,
        fecha: new Date().toISOString().slice(0, 10),
        subidoPor: user?.name || "Sistema",
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "archivosExpediente"), nuevoArchivo);
      setArchivosExpediente(prev => [{ ...nuevoArchivo, firebaseId: docRef.id }, ...prev]);
      notify.toast.success("Archivo subido correctamente.");
    } catch (error) {
      console.error("Error subiendo archivo de expediente:", error);
      notify.toast.error("No se pudo subir el archivo.");
    }
  };

  return {
    addEncuesta,
    sendMensaje,
    addNota,
    updateVacacionEstado,
    updatePermisoEstado,
    addSolicitudEmpleadoRH,
    updateDescuentoEstado,
    addDescuento,
    addReporteConfidencial,
    addReconocimiento,
    subirArchivoExpediente
  };
};
