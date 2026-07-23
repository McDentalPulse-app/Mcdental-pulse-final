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
import { crearComision as crearComisionDb, revisarComision as revisarComisionDb } from "../services/supabase/comisionesService";
import { addFestivo as addFestivoDb, deleteFestivo as deleteFestivoDb } from "../services/supabase/festivosService";
import { solicitarIntercambio as solicitarIntercambioDb, resolverIntercambio as resolverIntercambioDb } from "../services/supabase/intercambiosService";
import { addReporteConfidencial as addReporteConfidencialDb } from "../services/supabase/reportesService";
import { addReconocimiento as addReconocimientoDb } from "../services/supabase/reconocimientosService";
import { subirArchivoExpediente as subirArchivoExpedienteDb } from "../services/supabase/archivosExpedienteService";
import { registrarChecada as registrarChecadaDb } from "../services/supabase/asistenciasService";
import {
  addAviso as addAvisoDb,
  updateAviso as updateAvisoDb,
  deleteAviso as deleteAvisoDb,
  marcarAvisoLeido as marcarAvisoLeidoDb,
} from "../services/supabase/avisosService";

export const useAppActions = () => {
  const { usuarios: USERS } = useGlobal();

  const { user } = useAuth();
  const {
    // Los arrays se leen para poder revertir un update optimista si la escritura falla.
    vacaciones,
    permisos,
    descuentos,
    comisiones,
    intercambios,
    avisos,
    setVacaciones,
    setPermisos,
    setDescuentos,
    setComisiones,
    setFestivos,
    setIntercambios,
    setDestinosOcupados,
    setEncuestas,
    setMensajes,
    setNotas,
    setReportesConfidenciales,
    setReconocimientos,
    setArchivosExpediente,
    setChecadasHoy,
    setAvisos,
    setAvisosLeidos,
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

    // allSettled (y no all) para saber cuáles fallaron: revertir solo esos evita
    // marcar como no leído un mensaje que sí se persistió.
    const resultados = await Promise.allSettled(pendientes.map(m => marcarMensajeLeido(m.id)));
    const fallidos = new Set(
      pendientes.filter((_, i) => resultados[i].status === "rejected").map(m => m.id)
    );

    if (fallidos.size) {
      console.error("Error marcando mensajes como leídos:", resultados.find(r => r.reason)?.reason);
      setMensajes(prev => prev.map(m => fallidos.has(m.id) ? { ...m, leido: false } : m));
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
    const previo = vacaciones.find(v => v.id === id);
    setVacaciones(prev => prev.map(v => v.id === id ? { ...v, estado, comentarioRH } : v));

    try {
      await updateEstadoVacacionDb(id, estado, comentarioRH);
    } catch (error) {
      console.error("Error actualizando vacación:", error);
      // Sin revertir, la UI seguiría mostrando "aprobado" mientras la base sigue
      // en "pendiente", y la contradicción persiste hasta que se recargue.
      if (previo) setVacaciones(prev => prev.map(v => v.id === id ? previo : v));
      notify.toast.error("No se pudo actualizar la vacación.");
    }
  };

  const updatePermisoEstado = async (id, estado, comentarioRH = "") => {
    const previo = permisos.find(p => p.id === id);
    setPermisos(prev => prev.map(p => p.id === id ? { ...p, estado, comentarioRH } : p));

    try {
      await updateEstadoPermisoDb(id, estado, comentarioRH);
    } catch (error) {
      console.error("Error actualizando permiso:", error);
      if (previo) setPermisos(prev => prev.map(p => p.id === id ? previo : p));
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
          // Sin fechaFin, un permiso de varios días solo justificaría el primero y los
          // demás saldrían como faltas en el reporte de asistencia (migración 038).
          fechaFin: solicitud.fechaFin || null,
          causa: solicitud.causa || null,
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

  // Justifica una falta directamente (admin/rh/psicologa), sin pasar por el flujo normal
  // de solicitud+aprobación de permisos: se crea ya 'aprobado'. Reusa la misma justificación
  // que clasificarDia() ya busca (permiso aprobado que cubre la fecha) — cero lógica nueva
  // en el cálculo de asistencia, solo una forma de insertar el permiso.
  const justificarFalta = async ({ empleadoId, fecha, motivo }) => {
    try {
      const nuevo = await addPermiso({
        empleadoId,
        fecha,
        fechaFin: null,
        causa: "otro",
        motivo: "Corrección de falta",
        comentario: motivo,
        origen: "rh",
        estado: "aprobado",
      });
      setPermisos((prev) => [nuevo, ...prev]);
      notify.toast.success("Falta justificada.");
    } catch (error) {
      console.error("Error justificando falta:", error);
      notify.toast.error(error.message || "No se pudo justificar la falta.");
    }
  };

  const updateDescuentoEstado = async (id, estado) => {
    const previo = descuentos.find(d => d.id === id);
    setDescuentos(prev => prev.map(d => d.id === id ? { ...d, estado } : d));

    try {
      await updateDescuentoEstadoDb(id, estado);
    } catch (error) {
      console.error("Error actualizando descuento:", error);
      if (previo) setDescuentos(prev => prev.map(d => d.id === id ? previo : d));
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

  // El doctor sube un recibo (foto + nota). No es optimista: el registro depende de que la
  // foto suba primero al bucket, así que se espera la fila real que devuelve el servicio.
  const crearComision = async ({ archivo, nota }) => {
    try {
      const nueva = await crearComisionDb({ doctorId: user?.id, archivo, nota });
      setComisiones(prev => [nueva, ...prev]);
      notify.toast.success("Recibo enviado. RH lo revisará.");
      return true;
    } catch (error) {
      console.error("Error creando comisión:", error);
      notify.toast.error(error?.message || "No se pudo enviar el recibo.");
      return false;
    }
  };

  // RH valida/rechaza un recibo. Optimista con reversión, como los updates de vacaciones.
  const revisarComision = async (id, estado, comentario = "") => {
    const previo = comisiones.find(c => c.id === id);
    setComisiones(prev => prev.map(c => c.id === id ? { ...c, estado, comentarioRH: comentario } : c));

    try {
      await revisarComisionDb(id, estado, comentario);
      return true;
    } catch (error) {
      console.error("Error revisando comisión:", error);
      if (previo) setComisiones(prev => prev.map(c => c.id === id ? previo : c));
      notify.toast.error(error?.message || "No se pudo actualizar el recibo.");
      return false;
    }
  };

  // --- Calendario: festivos e intercambios de día ---------------------------

  // El empleado/doctor aparta un festivo para cambiarlo por otro día. No optimista: el índice
  // único del destino puede rechazarlo en el servidor, así que se espera la fila confirmada.
  const solicitarIntercambio = async ({ fechaFestivo, fechaDestino }) => {
    try {
      const nuevo = await solicitarIntercambioDb({ fechaFestivo, fechaDestino });
      setIntercambios(prev => [nuevo, ...prev]);
      setDestinosOcupados(prev => [...prev, nuevo.fechaDestino]);
      notify.toast.success("Solicitud enviada. RH la revisará.");
      return true;
    } catch (error) {
      console.error("Error solicitando intercambio:", error);
      notify.toast.error(error?.message || "No se pudo enviar la solicitud.");
      return false;
    }
  };

  // RH aprueba/rechaza. Optimista con reversión, como vacaciones.
  const resolverIntercambio = async (id, estado, comentario = "") => {
    const previo = intercambios.find(i => i.id === id);
    setIntercambios(prev => prev.map(i => i.id === id ? { ...i, estado, comentarioRH: comentario } : i));

    try {
      await resolverIntercambioDb(id, estado, comentario);
      return true;
    } catch (error) {
      console.error("Error resolviendo intercambio:", error);
      if (previo) setIntercambios(prev => prev.map(i => i.id === id ? previo : i));
      notify.toast.error(error?.message || "No se pudo actualizar la solicitud.");
      return false;
    }
  };

  const addFestivo = async ({ fecha, nombre }) => {
    try {
      const nuevo = await addFestivoDb({ fecha, nombre });
      setFestivos(prev => [...prev, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)));
      notify.toast.success("Festivo agregado.");
      return true;
    } catch (error) {
      console.error("Error agregando festivo:", error);
      notify.toast.error(error?.message || "No se pudo agregar el festivo.");
      return false;
    }
  };

  const deleteFestivo = async (id) => {
    const previos = [];
    setFestivos(prev => { previos.push(...prev); return prev.filter(f => f.id !== id); });

    try {
      await deleteFestivoDb(id);
      return true;
    } catch (error) {
      console.error("Error eliminando festivo:", error);
      setFestivos(previos);
      notify.toast.error(error?.message || "No se pudo eliminar el festivo.");
      return false;
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

  /**
   * Registra una entrada o una salida.
   *
   * Nunca optimista, al revés que los updates de esta misma pantalla: el id, la hora y
   * el estado de la ubicación los decide el SERVIDOR (registrar_checada, migración
   * 036). Pintar una checada antes de que la base responda sería inventarse una hora de
   * entrada en la interfaz — justo lo que este módulo existe para impedir.
   *
   * Devuelve la fila registrada para que la pantalla pueda decirle al empleado qué pasó
   * con su ubicación, o null si falló.
   */
  const registrarChecada = async ({ tipo, coords, selfieBlob, retoBlob, deviceId }) => {
    try {
      const checada = await registrarChecadaDb({
        tipo,
        coords,
        selfieBlob,
        retoBlob,
        deviceId,
        empleadoId: user?.id,
      });
      setChecadasHoy(prev => [...prev, checada]);
      return checada;
    } catch (error) {
      console.error("Error registrando la checada:", error);
      // El mensaje viene del servidor y ya está escrito para el usuario ("No pudimos
      // confirmar que eres tú", "Ya registraste tu entrada hace unos segundos"). Taparlo con
      // un genérico le quitaría lo único que le dice qué hacer a continuación.
      notify.toast.error(error?.message || "No se pudo registrar tu checada.");
      if (error?.aviso) notify.toast.warning(error.aviso);
      return null;
    }
  };

  const addAviso = async ({ titulo, cuerpo, sucursales }) => {
    try {
      const nuevo = await addAvisoDb({ titulo, cuerpo, creadoPor: user?.id, sucursales });
      setAvisos(prev => [nuevo, ...prev]);
      // La notificación a la plantilla (fila en la campana de cada quien) la dispara un trigger
      // de BD al insertarse el aviso (migración 065), no el cliente.
      return true;
    } catch (error) {
      console.error("Error guardando aviso:", error);
      notify.toast.error(error?.message || "No se pudo guardar el aviso.");
      return false;
    }
  };

  const updateAviso = async (id, { titulo, cuerpo, sucursales }) => {
    const previo = avisos.find(a => a.id === id);
    setAvisos(prev => prev.map(a => a.id === id ? { ...a, titulo, cuerpo, sucursales } : a));

    try {
      await updateAvisoDb({ id, titulo, cuerpo, sucursales });
      return true;
    } catch (error) {
      console.error("Error actualizando aviso:", error);
      if (previo) setAvisos(prev => prev.map(a => a.id === id ? previo : a));
      notify.toast.error(error?.message || "No se pudo actualizar el aviso.");
      return false;
    }
  };

  const deleteAviso = async (id) => {
    const previos = avisos;
    setAvisos(prev => prev.filter(a => a.id !== id));

    try {
      await deleteAvisoDb(id);
      return true;
    } catch (error) {
      console.error("Error eliminando aviso:", error);
      setAvisos(previos);
      notify.toast.error(error?.message || "No se pudo eliminar el aviso.");
      return false;
    }
  };

  // Sin optimismo ni revertir: si falla, el modal bloqueante simplemente lo vuelve a
  // ofrecer la próxima vez. Marcarlo como leído sin que la escritura se haya
  // confirmado sería la única forma en que un aviso se "perdería" sin que nadie lo viera.
  const marcarAvisoLeido = async (avisoId) => {
    try {
      const leido = await marcarAvisoLeidoDb(avisoId, user?.id);
      setAvisosLeidos(prev => [...prev, leido]);
      return true;
    } catch (error) {
      console.error("Error marcando aviso como leído:", error);
      notify.toast.error("No se pudo marcar el aviso como leído.");
      return false;
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
    crearComision,
    revisarComision,
    solicitarIntercambio,
    resolverIntercambio,
    addFestivo,
    deleteFestivo,
    addReporteConfidencial,
    addReconocimiento,
    subirArchivoExpediente,
    registrarChecada,
    justificarFalta,
    addAviso,
    updateAviso,
    deleteAviso,
    marcarAvisoLeido,
  };
};
