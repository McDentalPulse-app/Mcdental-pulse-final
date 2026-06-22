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

export default function PsicologaLayout({ user, globals, actions }) {
  const { usuarios: USERS } = useGlobal();

  const { encuestas, mensajes, notas, permisos, descuentos, reconocimientos, reportesConfidenciales, vacaciones } = globals;
  const { restablecerPasswordUsuario, addNota, sendMensaje } = actions;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          <Routes>
            <Route path="dashboard" element={<PsicologaDashboard encuestas={encuestas} mensajes={mensajes} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="ai" element={<AIEngine encuestas={encuestas} mensajes={mensajes} notas={notas} userRole="psicologa" permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales}/>} />
            <Route path="seguimiento" element={<PsicologaSeguimiento encuestas={encuestas} notas={notas} onUpdateNota={addNota}/>} />
            <Route path="confidenciales" element={<ReportesConfidencialesPanel reportes={reportesConfidenciales} />} />
            <Route path="empleados" element={<EmpleadosList encuestas={encuestas} notas={notas} role="psicologa" currentUser={user} onRestablecerPassword={restablecerPasswordUsuario} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="expedientes" element={<ExpedienteIntegral users={USERS} encuestas={encuestas} mensajes={mensajes} notas={notas} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} currentUser={user} />} />
            <Route path="mensajes" element={<Mensajes user={user} mensajes={mensajes} onSend={sendMensaje}/>} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
