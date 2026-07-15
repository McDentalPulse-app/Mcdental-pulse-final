import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import {
  MENSAJES_INIT,
  NOTAS_INIT,
  REPORTES_CONFIDENCIALES_INIT,
  CALENDARIO_EXTRA_INIT,
  ENCUESTA_PREGUNTAS,
} from "../data/initialData";

import { useAuth } from "./AuthContext";
import { notify } from "../utils/notify";

import { getEncuestas, subscribeEncuestas } from "../services/supabase/encuestasService";
import { getMensajes } from "../services/supabase/mensajesService";
import { getReportesConfidenciales } from "../services/supabase/reportesService";
import { getReconocimientos } from "../services/supabase/reconocimientosService";
import { getVacaciones } from "../services/supabase/vacacionesService";
import { getPermisos } from "../services/supabase/permisosService";
import { getDescuentos } from "../services/supabase/descuentosService";
import { getArchivosExpediente } from "../services/supabase/archivosExpedienteService";
import { getNotasPsicologicas } from "../services/supabase/notasService";
import { getUsuarios, getUsuariosDirectorio, getEncuestaPreguntas } from "../services/supabase/usuariosService";
import { getAsistencias } from "../services/supabase/asistenciasService";
import { getHorarios } from "../services/supabase/horariosService";
import { normalizePreguntasList } from "../utils/encuestaPreguntas";
import { TZ_CLINICA } from "../utils/asistencia";

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const { user } = useAuth();
  // Estados iniciales
  const [usuarios, setUsuarios] = useState([]);
  const [encuestaPreguntas, setEncuestaPreguntas] = useState(() =>
    normalizePreguntasList(ENCUESTA_PREGUNTAS)
  );
  const [encuestas, setEncuestas] = useState([]);
  const [mensajes, setMensajes] = useState(MENSAJES_INIT);
  const [reportesConfidenciales, setReportesConfidenciales] = useState(REPORTES_CONFIDENCIALES_INIT);
  const [reconocimientos, setReconocimientos] = useState([]);

  // Expedientes
  const [archivosExpediente, setArchivosExpediente] = useState([]);
  const [vacaciones, setVacaciones] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [descuentos, setDescuentos] = useState([]);

  // Asistencia.
  //
  // Aquí vive SOLO lo que la app necesita en todo momento: el horario del usuario y sus
  // checadas de HOY (para que el botón sepa si toca "Entrada" o "Salida"). El histórico
  // NO está en el contexto global a propósito: son ~30.000 filas al año y este contexto
  // se carga entero en cada login. Las pantallas de historial y reportes lo piden ellas
  // mismas, acotado por rango (patrón de BolsaTrabajo.jsx).
  const [horarios, setHorarios] = useState([]);
  const [checadasHoy, setChecadasHoy] = useState([]);

  // Notas AI / Calendario
  const [notas, setNotas] = useState(NOTAS_INIT);
  const [calendario, setCalendario] = useState([]);
  const [calendarioExtra] = useState(CALENDARIO_EXTRA_INIT);

  const [loadingData, setLoadingData] = useState(true);

  // Cargar datos de Supabase según el rol del usuario
  useEffect(() => {
    const fetchAllData = async () => {
      if (!user) {
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        const promises = [];
        const { role } = user;
        // Sentinela: null = no se cargó (no pedido, o falló). Un array (incluso
        // vacío) = fetch OK. Así "error de red" no se confunde con "0 datos".
        let huboError = false;

        let dbUsuarios = null;
        let dbPreguntas = null;
        let dbEncuestas = null;
        let dbMensajes = null;
        let dbReportes = null;
        let dbReconocimientos = null;
        let dbArchivos = null;
        let dbVacaciones = null;
        let dbPermisos = null;
        let dbDescuentos = null;
        let dbNotas = null;
        let dbHorarios = null;
        let dbChecadasHoy = null;

        // Base data for everyone.
        // La PII de la plantilla (teléfono, email, fechas) solo la necesitan los roles
        // que gestionan expedientes y altas. Un empleado lee el directorio, que no la
        // trae — así deja de poder sacar los datos personales de sus compañeros
        // (migración 030). El RLS lo garantiza aunque el cliente pidiera otra cosa.
        const puedeVerPII = role === "admin" || role === "rh" || role === "psicologa";
        const cargarUsuarios = puedeVerPII ? getUsuarios : getUsuariosDirectorio;

        promises.push(cargarUsuarios().then(res => dbUsuarios = res).catch(() => { huboError = true; }));
        promises.push(getEncuestaPreguntas().then(res => dbPreguntas = res).catch(() => { huboError = true; }));

        // Encuestas y mensajes y reconocimientos: admin, rh, psicologa, empleado
        // (rh ahora tiene paridad admin: AI Engine, Encuestas, Reconocimientos)
        if (role === "admin" || role === "rh" || role === "psicologa" || role === "empleado") {
          promises.push(getEncuestas().then(res => dbEncuestas = res).catch(() => { huboError = true; }));
          promises.push(getMensajes().then(res => dbMensajes = res).catch(() => { huboError = true; }));
          promises.push(getReconocimientos().then(res => dbReconocimientos = res).catch(() => { huboError = true; }));
        }

        // Reportes confidenciales: admin, rh, psicologa (rh con paridad admin)
        if (role === "admin" || role === "rh" || role === "psicologa") {
          promises.push(getReportesConfidenciales().then(res => dbReportes = res).catch(() => { huboError = true; }));
        }

        // Vacaciones y permisos: admin, rh, psicologa, empleado
        if (role === "admin" || role === "rh" || role === "psicologa" || role === "empleado") {
          promises.push(getVacaciones().then(res => dbVacaciones = res).catch(() => { huboError = true; }));
          promises.push(getPermisos().then(res => dbPermisos = res).catch(() => { huboError = true; }));
        }

        // Descuentos: admin, rh, psicologa
        if (role === "admin" || role === "rh" || role === "psicologa") {
          promises.push(getDescuentos().then(res => dbDescuentos = res).catch(() => { huboError = true; }));
        }

        // Archivos Expediente: admin, psicologa, rh
        if (role === "admin" || role === "psicologa" || role === "rh") {
          promises.push(getArchivosExpediente().then(res => dbArchivos = res).catch(() => { huboError = true; }));
        }

        // Notas psicológicas: admin, rh, psicologa (rh con paridad admin; gateado también por RLS)
        if (role === "admin" || role === "rh" || role === "psicologa") {
          promises.push(getNotasPsicologicas().then(res => dbNotas = res).catch(() => { huboError = true; }));
        }

        // Asistencia: horarios (todos los roles los necesitan — el empleado para ver el
        // suyo, RH y admin para la rejilla y los reportes) y las checadas de HOY.
        //
        // La fecha se pide en la zona de las clínicas, no en la del navegador: un
        // empleado con el móvil mal configurado, o de viaje, pediría "hoy" de otro día y
        // el botón le ofrecería una entrada que ya hizo. El servidor decide el día
        // natural con la misma zona (RPC registrar_checada), así que aquí se usa la
        // misma o las dos dejan de casar.
        const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(new Date());
        promises.push(getHorarios().then(res => dbHorarios = res).catch(() => { huboError = true; }));
        promises.push(
          getAsistencias({ desde: hoy, hasta: hoy, empleadoId: role === "empleado" ? user.id : undefined })
            .then(res => dbChecadasHoy = res)
            .catch(() => { huboError = true; })
        );

        await Promise.all(promises);

        // Solo se actualiza el estado cuando el fetch respondió (array, aunque
        // sea vacío). Si falló (null), se conserva el estado previo en vez de
        // pisarlo con datos vacíos que parecerían "sin registros".
        if (dbUsuarios) setUsuarios(dbUsuarios);
        if (dbPreguntas && dbPreguntas.length > 0) {
          setEncuestaPreguntas(normalizePreguntasList(dbPreguntas));
        } else if (dbPreguntas) {
          setEncuestaPreguntas(normalizePreguntasList(ENCUESTA_PREGUNTAS));
        }
        if (dbEncuestas) setEncuestas(dbEncuestas);
        if (dbMensajes) setMensajes(dbMensajes);
        if (dbReportes) setReportesConfidenciales(dbReportes);
        if (dbReconocimientos) setReconocimientos(dbReconocimientos);

        if (dbArchivos) setArchivosExpediente(dbArchivos);
        if (dbVacaciones) setVacaciones(dbVacaciones);
        if (dbPermisos) setPermisos(dbPermisos);
        if (dbDescuentos) setDescuentos(dbDescuentos);
        if (dbNotas) setNotas(dbNotas);
        if (dbHorarios) setHorarios(dbHorarios);
        if (dbChecadasHoy) setChecadasHoy(dbChecadasHoy);

        if (huboError) {
          notify.toast.error("No se pudieron cargar algunos datos. Revisa tu conexión.");
        }

      } catch (error) {
        console.error("Error global al cargar datos de Supabase:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAllData();
  }, [user]);

  // Refetch puntual de encuestas (para sincronización en vivo). Si la red
  // falla se conserva el estado previo, igual que en la carga inicial.
  const refreshEncuestas = useCallback(async () => {
    try {
      const rows = await getEncuestas();
      setEncuestas(rows);
    } catch (error) {
      console.error("Error refrescando encuestas:", error);
    }
  }, []);

  // Sincronización en vivo de encuestas para los roles que las consumen:
  // 1) Realtime INSERT (instantáneo cuando la publicación esté habilitada),
  // 2) refetch al volver a la pestaña (visibilitychange),
  // 3) polling suave cada 60s como fallback, solo con la pestaña visible.
  useEffect(() => {
    if (!user) return;
    const { role } = user;
    if (role !== "admin" && role !== "psicologa" && role !== "empleado") return;

    const unsubscribe = subscribeEncuestas((nueva) => {
      setEncuestas((prev) => (prev.some((e) => e.id === nueva.id) ? prev : [...prev, nueva]));
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshEncuestas();
    };
    document.addEventListener("visibilitychange", onVisible);

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") refreshEncuestas();
    }, 60000);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(intervalId);
    };
  }, [user, refreshEncuestas]);

  return (
    <GlobalContext.Provider
      value={{
        usuarios, setUsuarios,
        encuestaPreguntas, setEncuestaPreguntas,
        encuestas, setEncuestas,
        mensajes, setMensajes,
        reportesConfidenciales, setReportesConfidenciales,
        reconocimientos, setReconocimientos,
        archivosExpediente, setArchivosExpediente,
        vacaciones, setVacaciones,
        permisos, setPermisos,
        descuentos, setDescuentos,
        notas, setNotas,
        horarios, setHorarios,
        checadasHoy, setChecadasHoy,
        calendario, setCalendario,
        calendarioExtra,
        loadingData
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => {
  return useContext(GlobalContext);
};
