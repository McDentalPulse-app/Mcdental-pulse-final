import React, { createContext, useState, useContext, useEffect } from "react";
import { 
  MENSAJES_INIT, 
  NOTAS_INIT, 
  REPORTES_CONFIDENCIALES_INIT,
  CALENDARIO_EXTRA_INIT
} from "../data/initialData";

import { useAuth } from "./AuthContext";

import { getEncuestas } from "../services/firestore/encuestasService";
import { getMensajes } from "../services/firestore/mensajesService";
import { getReportesConfidenciales } from "../services/firestore/reportesService";
import { getReconocimientos } from "../services/firestore/reconocimientosService";
import { getArchivosExpediente, getVacaciones, getPermisos, getDescuentos } from "../services/firestore/expedientesService";

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const { user } = useAuth();
  // Estados iniciales
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

  // Cargar datos de Firebase según el rol del usuario
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

        let fbEncuestas = [];
        let fbMensajes = [];
        let fbReportes = [];
        let fbReconocimientos = [];
        let fbArchivos = [];
        let fbVacaciones = [];
        let fbPermisos = [];
        let fbDescuentos = [];

        // Encuestas y mensajes y reconocimientos: admin, psicologa, empleado
        if (role === "admin" || role === "psicologa" || role === "empleado") {
          promises.push(getEncuestas().then(res => fbEncuestas = res).catch(() => []));
          promises.push(getMensajes().then(res => fbMensajes = res).catch(() => []));
          promises.push(getReconocimientos().then(res => fbReconocimientos = res).catch(() => []));
        }

        // Reportes confidenciales: admin, psicologa
        if (role === "admin" || role === "psicologa") {
          promises.push(getReportesConfidenciales().then(res => fbReportes = res).catch(() => []));
        }

        // Vacaciones y permisos: admin, rh, psicologa, empleado
        if (role === "admin" || role === "rh" || role === "psicologa" || role === "empleado") {
          promises.push(getVacaciones().then(res => fbVacaciones = res).catch(() => []));
          promises.push(getPermisos().then(res => fbPermisos = res).catch(() => []));
        }

        // Descuentos: admin, rh, psicologa
        if (role === "admin" || role === "rh" || role === "psicologa") {
          promises.push(getDescuentos().then(res => fbDescuentos = res).catch(() => []));
        }

        // Archivos Expediente: admin, psicologa, rh
        if (role === "admin" || role === "psicologa" || role === "rh") {
          promises.push(getArchivosExpediente().then(res => fbArchivos = res).catch(() => []));
        }

        await Promise.all(promises);

        if (fbEncuestas.length > 0) setEncuestas(fbEncuestas);
        if (fbMensajes.length > 0) setMensajes(fbMensajes);
        if (fbReportes.length > 0) setReportesConfidenciales(fbReportes);
        if (fbReconocimientos.length > 0) setReconocimientos(fbReconocimientos);
        
        if (fbArchivos.length > 0) setArchivosExpediente(fbArchivos);
        if (fbVacaciones.length > 0) setVacaciones(fbVacaciones);
        if (fbPermisos.length > 0) setPermisos(fbPermisos);
        if (fbDescuentos.length > 0) setDescuentos(fbDescuentos);

      } catch (error) {
        console.error("Error global al cargar datos de Firebase:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchAllData();
  }, [user]);

  return (
    <GlobalContext.Provider 
      value={{ 
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
