import React, { createContext, useState, useContext, useEffect } from "react";
import {
  MENSAJES_INIT,
  NOTAS_INIT,
  REPORTES_CONFIDENCIALES_INIT,
  CALENDARIO_EXTRA_INIT,
  ENCUESTA_PREGUNTAS,
} from "../data/initialData";

import { useAuth } from "./AuthContext";
import { notify } from "../utils/notify";

import { getEncuestas } from "../services/supabase/encuestasService";
import { getMensajes } from "../services/supabase/mensajesService";
import { getReportesConfidenciales } from "../services/supabase/reportesService";
import { getReconocimientos } from "../services/supabase/reconocimientosService";
import { getVacaciones } from "../services/supabase/vacacionesService";
import { getPermisos } from "../services/supabase/permisosService";
import { getDescuentos } from "../services/supabase/descuentosService";
import { getArchivosExpediente } from "../services/supabase/archivosExpedienteService";
import { getNotasPsicologicas } from "../services/supabase/notasService";
import { getUsuarios, getEncuestaPreguntas } from "../services/supabase/usuariosService";
import { normalizePreguntasList } from "../utils/encuestaPreguntas";

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

        // Base data for everyone
        promises.push(getUsuarios().then(res => dbUsuarios = res).catch(() => { huboError = true; }));
        promises.push(getEncuestaPreguntas().then(res => dbPreguntas = res).catch(() => { huboError = true; }));

        // Encuestas y mensajes y reconocimientos: admin, psicologa, empleado
        if (role === "admin" || role === "psicologa" || role === "empleado") {
          promises.push(getEncuestas().then(res => dbEncuestas = res).catch(() => { huboError = true; }));
          promises.push(getMensajes().then(res => dbMensajes = res).catch(() => { huboError = true; }));
          promises.push(getReconocimientos().then(res => dbReconocimientos = res).catch(() => { huboError = true; }));
        }

        // Reportes confidenciales: admin, psicologa
        if (role === "admin" || role === "psicologa") {
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

        // Notas psicológicas: psicologa, admin (gateado también por RLS)
        if (role === "admin" || role === "psicologa") {
          promises.push(getNotasPsicologicas().then(res => dbNotas = res).catch(() => { huboError = true; }));
        }

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
