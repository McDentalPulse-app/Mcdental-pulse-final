import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate } from 'react-router-dom';
import Navegacion from './Navegacion';
import AdminDashboard from '../dashboards/AdminDashboard';
import AIEngine from '../ia/AIEngine';
import EmpleadosList from '../empleados/EmpleadosList';
import ExpedienteIntegral from '../empleados/ExpedienteIntegral';
import ReconocimientosGestion from '../rh/ReconocimientosGestion';
import EventosPersonal from '../empleados/EventosPersonal';
import Reportes from '../rh/Reportes';
import ReportesConfidencialesPanel from '../psicologia/ReportesConfidencialesPanel';
import Config from '../settings/Config';
import GestionUsuarios from '../admin/GestionUsuarios';
import GestionEncuestas from '../admin/GestionEncuestas';
import GestionSucursales from '../admin/GestionSucursales';
import GestionHorarios from '../admin/GestionHorarios';
import ImportarHorarios from '../admin/ImportarHorarios';
import Calibracion from '../admin/Calibracion';
import AsistenciaPanel from '../asistencia/AsistenciaPanel';
import EnrolarRostros from '../asistencia/EnrolarRostros';
import Perfil from '../common/Perfil';
import IdeasMejora from '../common/IdeasMejora';
import Mensajes from '../comunicacion/Mensajes';
import AvisoPush from '../asistencia/AvisoPush';
import { useAvisoPush } from '../../hooks/useAvisoPush';
import AvisosPanel from '../avisos/AvisosPanel';

import AvisoUbicacion from '../asistencia/AvisoUbicacion';
import { useAvisoUbicacion } from '../../hooks/useAvisoUbicacion';
export default function AdminLayout({ user, globals, actions }) {
  const { usuarios: USERS, encuestaPreguntas } = useGlobal();

  const { encuestas, mensajes, notas, permisos, descuentos, reconocimientos, reportesConfidenciales, vacaciones, archivosExpediente, horarios, setHorarios, avisos } = globals;
  const { restablecerPasswordUsuario, sendMensaje, marcarMensajesLeidos, subirArchivoExpediente, eliminarArchivoExpediente, addReconocimiento, addAviso, updateAviso, deleteAviso, justificarFalta } = actions;
  const { ofrecerPush, activarAvisos, cerrarOfertaPush } = useAvisoPush();

  const { ofrecerUbicacion, estadoUbicacion, activarUbicacion, cerrarAviso } = useAvisoUbicacion();


  return (
    <div className="app-shell">
      <Navegacion />
      <main className="app-main">
        <div className="app-main-inner">
          {ofrecerUbicacion && (
            <AvisoUbicacion estado={estadoUbicacion} onActivar={activarUbicacion} onCerrar={cerrarAviso} />
          )}
          {ofrecerPush && <AvisoPush onActivar={activarAvisos} onCerrar={cerrarOfertaPush} />}
          <Routes>
            <Route path="dashboard" element={<AdminDashboard encuestas={encuestas} mensajes={mensajes}/>} />
            <Route path="ai" element={<AIEngine encuestas={encuestas} mensajes={mensajes} notas={notas} userRole="admin" permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales}/>} />
            <Route path="empleados" element={<EmpleadosList encuestas={encuestas} notas={notas} role="admin" currentUser={user} onRestablecerPassword={restablecerPasswordUsuario} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="usuarios" element={<GestionUsuarios />} />
            {/* puedeAnular: admin también puede anular checadas (migración 060 amplía el
                UPDATE de asistencias, antes exclusivo de RH). puedeJustificar: admin/rh/
                psicologa pueden justificar una falta directo (migración 061). */}
            <Route path="asistencia" element={<AsistenciaPanel usuarios={USERS} horarios={horarios} permisos={permisos} vacaciones={vacaciones} puedeAnular puedeJustificar onJustificarFalta={justificarFalta} />} />
            <Route path="sucursales" element={<GestionSucursales />} />
            <Route path="horarios" element={<GestionHorarios usuarios={USERS} horarios={horarios} setHorarios={setHorarios} />} />
            <Route path="importar-horarios" element={<ImportarHorarios usuarios={USERS} />} />
            <Route path="calibracion" element={<Calibracion usuarios={USERS} />} />
            <Route path="rostros" element={<EnrolarRostros usuarios={USERS} />} />
            <Route path="expedientes" element={<ExpedienteIntegral users={USERS} encuestas={encuestas} mensajes={mensajes} notas={notas} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} currentUser={user} archivosExpediente={archivosExpediente} onSubirArchivoExpediente={subirArchivoExpediente} onEliminarArchivoExpediente={eliminarArchivoExpediente} />} />
            <Route path="reconocimientos" element={<ReconocimientosGestion users={USERS} reconocimientos={reconocimientos} onAdd={addReconocimiento} currentUser={user} />} />
            <Route path="eventospersonal" element={<EventosPersonal users={USERS} />} />
            <Route path="reportes" element={<Reportes users={USERS} encuestas={encuestas} preguntas={encuestaPreguntas} />} />
            <Route path="confidenciales" element={<ReportesConfidencialesPanel reportes={reportesConfidenciales} />} />
            <Route path="config" element={<Config />} />
            <Route path="encuestas" element={<GestionEncuestas encuestas={encuestas} />} />
            <Route path="mensajes" element={<Mensajes user={user} mensajes={mensajes} onSend={sendMensaje} onMarkRead={marcarMensajesLeidos} />} />
            <Route path="soporte" element={<IdeasMejora />} />
            <Route path="avisos" element={<AvisosPanel user={user} avisos={avisos} onAdd={addAviso} onUpdate={updateAviso} onDelete={deleteAviso} />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
