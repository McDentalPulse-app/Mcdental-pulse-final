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
import Perfil from '../common/Perfil';

export default function AdminLayout({ user, globals, actions }) {
  const { usuarios: USERS } = useGlobal();

  const { encuestas, mensajes, notas, permisos, descuentos, reconocimientos, reportesConfidenciales, vacaciones, archivosExpediente } = globals;
  const { restablecerPasswordUsuario, subirArchivoExpediente, addReconocimiento } = actions;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          <Routes>
            <Route path="dashboard" element={<AdminDashboard encuestas={encuestas} mensajes={mensajes}/>} />
            <Route path="ai" element={<AIEngine encuestas={encuestas} mensajes={mensajes} notas={notas} userRole="admin" permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales}/>} />
            <Route path="empleados" element={<EmpleadosList encuestas={encuestas} notas={notas} role="admin" currentUser={user} onRestablecerPassword={restablecerPasswordUsuario} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="usuarios" element={<GestionUsuarios />} />
            <Route path="expedientes" element={<ExpedienteIntegral users={USERS} encuestas={encuestas} mensajes={mensajes} notas={notas} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} currentUser={user} archivosExpediente={archivosExpediente} onSubirArchivoExpediente={subirArchivoExpediente} />} />
            <Route path="reconocimientos" element={<ReconocimientosGestion users={USERS} reconocimientos={reconocimientos} onAdd={addReconocimiento} currentUser={user} />} />
            <Route path="eventospersonal" element={<EventosPersonal users={USERS} />} />
            <Route path="reportes" element={<Reportes users={USERS} encuestas={encuestas} />} />
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
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
