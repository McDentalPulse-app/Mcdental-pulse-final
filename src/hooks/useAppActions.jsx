import { getPsicologaPrincipal } from "../utils/psicologa";
import { notify } from "../utils/notify";
import { useGlobal } from "../contexts/GlobalContext";
import { useAuth } from "../contexts/AuthContext";

import { addEncuesta as addEncuestaDb } from "../services/supabase/encuestasService";
import { sendMensaje as sendMensajeDb, marcarMensajeLeido } from "../services/supabase/mensajesService";
import { addNota as addNotaDb } from "../services/supabase/notasService";
import { addVacacion, updateEstadoVacacion as updateEstadoVacacionDb } from "../services/supabase/vacacionesService";
import { addPermiso, updateEstadoPermiso as updateEstadoPermisoDb } from "../services/supabase/permisosService";
import { addDescuento as addDescuentoDb, updateDescuentoEstado as updateDescuentoEstadoDb } from "../services/supabase/descuentosService";
import { addReporteConfidencial as addReporteConfidencialDb } from "../services/supabase/reportesService";
import { addReconocimiento as addReconocimientoDb } from "../services/supabase/reconocimientosService";
import { subirArchivoExpediente as subirArchivoExpedienteDb } from "../services/supabase/archivosExpedienteService";

export const useAppActions = () => {
  const { usuarios: USERS } = useGlobal();

  const { user } = useAuth();
  const {
    setVacaciones,
    setPermisos,
    setDescuentos,
    setEncuestas,
    setMensajes,
    setNotas,
    setReportesConfidenciales,
    setReconocimientos,
    setArchivosExpediente,
  } = useGlobal();

  const addEncuesta = async (enc) => {
    try {
      const nuevaEncuesta = await addEncuestaDb(enc);
      setEncuestas(prev => [...prev, nuevaEncuesta]);
      return true;
    } catch (error) {
      console.error("Error guardando encuesta:", error);
      notify.toast.error("No se pudo guardar la encuesta.");
      return false;
    }
  };

  const sendMensaje = async (msg) => {
    try {
      const nuevoMensaje = await sendMensajeDb(msg);
      setMensajes(prev => [...prev, nuevoMensaje]);
      return true;
    } catch (error) {
      console.error("Error guardando mensaje:", error);
      notify.toast.error("No se pudo enviar el mensaje.");
      return false;
    }
  };

  // Marca como leídos (persistente) los mensajes recibidos al abrir la conversación.
  const marcarMensajesLeidos = async (msgs) => {
    const pendientes = (msgs || []).filter(m => !m.leido);
    if (!pendientes.length) return;

    const ids = new Set(pendientes.map(m => m.id));
    setMensajes(prev => prev.map(m => ids.has(m.id) ? { ...m, leido: true } : m));

    try {
      await Promise.all(pendientes.map(m => marcarMensajeLeido(m.id)));
    } catch (error) {
      console.error("Error marcando mensajes como leídos:", error);
    }
  };

  const addNota = async (empleadoId, texto) => {
    if (!texto.trim()) return;

    try {
      const nuevaNota = await addNotaDb({
        empleadoId,
        autorId: user?.id || null,
        autor: user?.name || getPsicologaPrincipal(USERS)?.name || "Psicóloga",
        texto,
      });
      setNotas(prev => [...prev, nuevaNota]);
    } catch (error) {
      console.error("Error guardando nota psicológica:", error);
      notify.toast.error("No se pudo guardar la nota.");
    }
  };

  const updateVacacionEstado = async (id, estado, comentarioRH = "") => {
    setVacaciones(prev => prev.map(v => v.id === id ? { ...v, estado, comentarioRH } : v));

    try {
      await updateEstadoVacacionDb(id, estado, comentarioRH);
    } catch (error) {
      console.error("Error actualizando vacación:", error);
      notify.toast.error("No se pudo actualizar la vacación.");
    }
  };

  const updatePermisoEstado = async (id, estado, comentarioRH = "") => {
    setPermisos(prev => prev.map(p => p.id === id ? { ...p, estado, comentarioRH } : p));

    try {
      await updateEstadoPermisoDb(id, estado, comentarioRH);
    } catch (error) {
      console.error("Error actualizando permiso:", error);
      notify.toast.error("No se pudo actualizar el permiso.");
    }
  };

  const addSolicitudEmpleadoRH = async (solicitud) => {
    if (solicitud.tipo === "Vacaciones") {
      try {
        const nuevaVacacion = await addVacacion({
          empleadoId: solicitud.empleadoId,
          fechaInicio: solicitud.fechaInicio,
          fechaFin: solicitud.fechaFin,
          dias: solicitud.dias || 1,
          motivo: solicitud.motivo,
          comentario: solicitud.comentario || "",
          origen: "empleado",
        });
        setVacaciones((prev) => [nuevaVacacion, ...prev]);
      } catch (error) {
        console.error("Error guardando vacación:", error);
        notify.toast.error("No se pudo guardar la solicitud de vacaciones.");
      }
      return;
    }

    if (solicitud.tipo === "Permisos") {
      try {
        const nuevoPermiso = await addPermiso({
          empleadoId: solicitud.empleadoId,
          fecha: solicitud.fechaInicio || solicitud.fecha,
          hora: solicitud.hora,
          motivo: solicitud.motivo,
          comentario: solicitud.comentario || "",
          origen: "empleado",
        });
        setPermisos((prev) => [nuevoPermiso, ...prev]);
      } catch (error) {
        console.error("Error guardando permiso:", error);
        notify.toast.error("No se pudo guardar la solicitud de permiso.");
      }
    }
  };

  const updateDescuentoEstado = async (id, estado) => {
    setDescuentos(prev => prev.map(d => d.id === id ? { ...d, estado } : d));

    try {
      await updateDescuentoEstadoDb(id, estado);
    } catch (error) {
      console.error("Error actualizando descuento:", error);
      notify.toast.error("No se pudo actualizar el descuento.");
    }
  };

  const addDescuento = async (descuento) => {
    try {
      const nuevoDescuento = await addDescuentoDb({
        ...descuento,
        responsableId: user?.id || null,
        responsable: descuento.responsable || user?.name || "Administración",
      });
      setDescuentos(prev => [...prev, nuevoDescuento]);
    } catch (error) {
      console.error("Error guardando descuento:", error);
      notify.toast.error("No se pudo guardar el descuento.");
    }
  };

  const addReporteConfidencial = async (reporte) => {
    try {
      const nuevoReporte = await addReporteConfidencialDb(reporte);
      setReportesConfidenciales(prev => [...prev, nuevoReporte]);
    } catch (error) {
      console.error("Error enviando reporte confidencial:", error);
      notify.toast.error("No se pudo guardar el reporte confidencial.");
    }
  };

  const addReconocimiento = async (rec) => {
    try {
      const nuevoRec = await addReconocimientoDb({
        ...rec,
        otorgadoPorId: user?.id || null,
        otorgadoPor: rec.otorgadoPor || user?.name || "Recursos Humanos",
      });
      setReconocimientos(prev => [...prev, nuevoRec]);
    } catch (error) {
      console.error("Error enviando reconocimiento:", error);
      notify.toast.error("No se pudo guardar el reconocimiento.");
    }
  };

  const subirArchivoExpediente = async ({ empleado, archivo, tipo }) => {
    if (!empleado || !archivo) {
      notify.toast.warning("Selecciona empleado y archivo.");
      return;
    }

    try {
      const nuevoArchivo = await subirArchivoExpedienteDb({
        empleadoId: empleado.id,
        archivo,
        tipo,
        subidoPor: user?.id || null,
      });
      setArchivosExpediente(prev => [nuevoArchivo, ...prev]);
      notify.toast.success("Archivo subido correctamente.");
    } catch (error) {
      console.error("Error subiendo archivo de expediente:", error);
      notify.toast.error(error?.message || "No se pudo subir el archivo.");
    }
  };

  return {
    addEncuesta,
    sendMensaje,
    marcarMensajesLeidos,
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
