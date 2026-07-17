import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import PsicologaDashboard from '../dashboards/PsicologaDashboard';
import AIEngine from '../ia/AIEngine';
import PsicologaSeguimiento from '../psicologia/PsicologaSeguimiento';
import ReportesConfidencialesPanel from '../psicologia/ReportesConfidencialesPanel';
import EmpleadosList from '../empleados/EmpleadosList';
import ExpedienteIntegral from '../empleados/ExpedienteIntegral';
import Mensajes from '../comunicacion/Mensajes';
import GestionUsuarios from '../admin/GestionUsuarios';
import GestionSucursales from '../admin/GestionSucursales';
import GestionEncuestas from '../admin/GestionEncuestas';
import GestionHorarios from '../admin/GestionHorarios';
import ImportarHorarios from '../admin/ImportarHorarios';
import Calibracion from '../admin/Calibracion';
import AsistenciaPanel from '../asistencia/AsistenciaPanel';
import EnrolarRostros from '../asistencia/EnrolarRostros';
import ReconocimientosGestion from '../rh/ReconocimientosGestion';
import PermisosRH from '../rh/PermisosRH';
import VacacionesRH from '../rh/VacacionesRH';
import EventosPersonal from '../empleados/EventosPersonal';
import Reportes from '../rh/Reportes';
import Config from '../settings/Config';
import Perfil from '../common/Perfil';
import SoporteTI from '../common/SoporteTI';
import AvisoPush from '../asistencia/AvisoPush';
import { useAvisoPush } from '../../hooks/useAvisoPush';
import AvisosPanel from '../avisos/AvisosPanel';

export default function PsicologaLayout({ user, globals, actions }) {
  const { usuarios: USERS, encuestaPreguntas } = useGlobal();

  const { encuestas, mensajes, notas, permisos, descuentos, reconocimientos, reportesConfidenciales, vacaciones, horarios, setHorarios, archivosExpediente, avisos } = globals;
  const { restablecerPasswordUsuario, addNota, sendMensaje, marcarMensajesLeidos, addReconocimiento, subirArchivoExpediente, addAviso, updateAviso, deleteAviso, justificarFalta, updatePermisoEstado, updateVacacionEstado } = actions;
  const { ofrecerPush, activarAvisos, cerrarOfertaPush } = useAvisoPush();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          {ofrecerPush && <AvisoPush onActivar={activarAvisos} onCerrar={cerrarOfertaPush} />}
          <Routes>
            <Route path="dashboard" element={<PsicologaDashboard encuestas={encuestas} mensajes={mensajes} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="ai" element={<AIEngine encuestas={encuestas} mensajes={mensajes} notas={notas} userRole="psicologa" permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales}/>} />
            {/* La psicóloga (jefa de RH) también aprueba permisos y vacaciones. */}
            <Route path="vacaciones" element={<VacacionesRH vacaciones={vacaciones} onUpdateEstado={updateVacacionEstado} />} />
            <Route path="permisos" element={<PermisosRH permisos={permisos} onUpdateEstado={updatePermisoEstado} horarios={horarios} />} />
            <Route path="seguimiento" element={<PsicologaSeguimiento encuestas={encuestas} notas={notas} onUpdateNota={addNota}/>} />
            <Route path="confidenciales" element={<ReportesConfidencialesPanel reportes={reportesConfidenciales} />} />
            <Route path="empleados" element={<EmpleadosList encuestas={encuestas} notas={notas} role="psicologa" currentUser={user} onRestablecerPassword={restablecerPasswordUsuario} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="expedientes" element={<ExpedienteIntegral users={USERS} encuestas={encuestas} mensajes={mensajes} notas={notas} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} currentUser={user} archivosExpediente={archivosExpediente} onSubirArchivoExpediente={subirArchivoExpediente} />} />
            <Route path="mensajes" element={<Mensajes user={user} mensajes={mensajes} onSend={sendMensaje} onMarkRead={marcarMensajesLeidos}/>} />
            <Route path="usuarios" element={<GestionUsuarios />} />
            <Route path="asistencia" element={<AsistenciaPanel usuarios={USERS} horarios={horarios} permisos={permisos} vacaciones={vacaciones} puedeJustificar onJustificarFalta={justificarFalta} />} />
            <Route path="sucursales" element={<GestionSucursales />} />
            <Route path="horarios" element={<GestionHorarios usuarios={USERS} horarios={horarios} setHorarios={setHorarios} />} />
            <Route path="importar-horarios" element={<ImportarHorarios usuarios={USERS} />} />
            <Route path="calibracion" element={<Calibracion usuarios={USERS} />} />
            <Route path="rostros" element={<EnrolarRostros usuarios={USERS} />} />
            <Route path="reconocimientos" element={<ReconocimientosGestion users={USERS} reconocimientos={reconocimientos} onAdd={addReconocimiento} currentUser={user} />} />
            <Route path="eventospersonal" element={<EventosPersonal users={USERS} />} />
            <Route path="encuestas" element={<GestionEncuestas encuestas={encuestas} />} />
            <Route path="reportes" element={<Reportes users={USERS} encuestas={encuestas} preguntas={encuestaPreguntas} />} />
            <Route path="config" element={<Config />} />
            <Route path="soporte" element={<SoporteTI user={user} />} />
            <Route path="avisos" element={<AvisosPanel user={user} avisos={avisos} onAdd={addAviso} onUpdate={updateAviso} onDelete={deleteAviso} />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
