import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminDashboard from '../dashboards/AdminDashboard';
import AIEngine from '../ia/AIEngine';
import EmpleadosList from '../empleados/EmpleadosList';
import ExpedienteIntegral from '../empleados/ExpedienteIntegral';
import ReconocimientosGestion from '../rh/ReconocimientosGestion';
import EventosPersonal from '../empleados/EventosPersonal';
import Reportes from '../rh/Reportes';
import ReportesConfidencialesPanel from '../psicologia/ReportesConfidencialesPanel';
import Config from '../settings/Config';
import Card from '../common/Card';
import Icon from '../ui/Icon';
import GestionUsuarios from '../admin/GestionUsuarios';
import GestionEncuestas from '../admin/GestionEncuestas';
import GestionSucursales from '../admin/GestionSucursales';
import GestionHorarios from '../admin/GestionHorarios';
import ImportarHorarios from '../admin/ImportarHorarios';
import Calibracion from '../admin/Calibracion';
import AsistenciaPanel from '../asistencia/AsistenciaPanel';
import EnrolarRostros from '../asistencia/EnrolarRostros';
import Perfil from '../common/Perfil';
import SoporteTI from '../common/SoporteTI';
import AvisoPush from '../asistencia/AvisoPush';
import { useAvisoPush } from '../../hooks/useAvisoPush';
import AvisosPanel from '../avisos/AvisosPanel';

export default function AdminLayout({ user, globals, actions }) {
  const { usuarios: USERS, encuestaPreguntas } = useGlobal();

  const { encuestas, mensajes, notas, permisos, descuentos, reconocimientos, reportesConfidenciales, vacaciones, archivosExpediente, horarios, setHorarios, avisos } = globals;
  const { restablecerPasswordUsuario, subirArchivoExpediente, addReconocimiento, addAviso, updateAviso, deleteAviso } = actions;
  const { ofrecerPush, activarAvisos, cerrarOfertaPush } = useAvisoPush();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          {ofrecerPush && <AvisoPush onActivar={activarAvisos} onCerrar={cerrarOfertaPush} />}
          <Routes>
            <Route path="dashboard" element={<AdminDashboard encuestas={encuestas} mensajes={mensajes}/>} />
            <Route path="ai" element={<AIEngine encuestas={encuestas} mensajes={mensajes} notas={notas} userRole="admin" permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales}/>} />
            <Route path="empleados" element={<EmpleadosList encuestas={encuestas} notas={notas} role="admin" currentUser={user} onRestablecerPassword={restablecerPasswordUsuario} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="usuarios" element={<GestionUsuarios />} />
            {/* Sin puedeAnular: el UPDATE de asistencias es exclusivo de RH en el RLS
                (migración 036), igual que ya pasa con permisos y vacaciones. Ofrecerle a
                admin un botón de anular que la base va a rechazar sería mentirle. */}
            <Route path="asistencia" element={<AsistenciaPanel usuarios={USERS} horarios={horarios} permisos={permisos} vacaciones={vacaciones} />} />
            <Route path="sucursales" element={<GestionSucursales />} />
            <Route path="horarios" element={<GestionHorarios usuarios={USERS} horarios={horarios} setHorarios={setHorarios} />} />
            <Route path="importar-horarios" element={<ImportarHorarios usuarios={USERS} />} />
            <Route path="calibracion" element={<Calibracion usuarios={USERS} />} />
            <Route path="rostros" element={<EnrolarRostros usuarios={USERS} />} />
            <Route path="expedientes" element={<ExpedienteIntegral users={USERS} encuestas={encuestas} mensajes={mensajes} notas={notas} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} currentUser={user} archivosExpediente={archivosExpediente} onSubirArchivoExpediente={subirArchivoExpediente} />} />
            <Route path="reconocimientos" element={<ReconocimientosGestion users={USERS} reconocimientos={reconocimientos} onAdd={addReconocimiento} currentUser={user} />} />
            <Route path="eventospersonal" element={<EventosPersonal users={USERS} />} />
            <Route path="reportes" element={<Reportes users={USERS} encuestas={encuestas} preguntas={encuestaPreguntas} />} />
            <Route path="confidenciales" element={<ReportesConfidencialesPanel reportes={reportesConfidenciales} />} />
            <Route path="config" element={<Config />} />
            <Route path="encuestas" element={<GestionEncuestas encuestas={encuestas} />} />
            <Route path="mensajes" element={
              <Card className="admin-restricted">
                <div className="admin-restricted-icon"><Icon name="lock" size={32} /></div>
                <h2 className="admin-restricted-title">Acceso restringido</h2>
                <p className="admin-restricted-text">Este canal es privado y solo está disponible para empleados y psicóloga.</p>
              </Card>
            } />
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
