import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import InicioEmpleado from '../empleados/InicioEmpleado';
import EncuestaEmpleado from '../empleados/EncuestaEmpleado';
import HistorialEmpleado from '../empleados/HistorialEmpleado';
import PermisosEmpleado from '../empleados/PermisosEmpleado';
import ReconocimientosEmpleado from '../empleados/ReconocimientosEmpleado';
import ReporteConfidencialEmpleado from '../empleados/ReporteConfidencialEmpleado';
import Mensajes from '../comunicacion/Mensajes';

export default function EmpleadoLayout({ user, globals, actions }) {
  const { usuarios: USERS } = useGlobal();

  const { encuestas, mensajes, vacaciones, permisos, reconocimientos } = globals;
  const { addEncuesta, sendMensaje, addSolicitudEmpleadoRH, addReporteConfidencial } = actions;
  const navigate = useNavigate();

  const userMensajes = mensajes.filter((m) => m.de === user?.id || m.para === user?.id);
  const psicologaId = USERS.find((u) => u.role === "psicologa")?.id || null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          <Routes>
            <Route path="inicio" element={<InicioEmpleado user={user} encuestas={encuestas} mensajes={userMensajes} setActive={(view) => navigate(`/empleado/${view}`)} />} />
            <Route path="encuesta" element={<EncuestaEmpleado user={user} encuestas={encuestas} onSubmit={addEncuesta}/>} />
            <Route path="historial" element={<HistorialEmpleado user={user} encuestas={encuestas} />} />
            <Route path="permisosempleado" element={<PermisosEmpleado user={user} vacaciones={vacaciones} permisos={permisos} onEnviarSolicitudEmpleado={addSolicitudEmpleadoRH}/>} />
            <Route path="reconocimientos" element={<ReconocimientosEmpleado user={user} reconocimientos={reconocimientos} />} />
            <Route path="reporteconfidencial" element={<ReporteConfidencialEmpleado user={user} onSubmit={addReporteConfidencial} />} />
            <Route path="mensajes" element={<Mensajes user={user} mensajes={userMensajes} onSend={(msg)=>sendMensaje({...msg,para:psicologaId})}/>} />
            <Route path="*" element={<Navigate to="inicio" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
