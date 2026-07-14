import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import InicioEmpleado from '../empleados/InicioEmpleado';
import EncuestaEmpleado from '../empleados/EncuestaEmpleado';
import HistorialEmpleado from '../empleados/HistorialEmpleado';
import PermisosEmpleado from '../empleados/PermisosEmpleado';
import ChecadorEmpleado from '../asistencia/ChecadorEmpleado';
import ReconocimientosEmpleado from '../empleados/ReconocimientosEmpleado';
import ReporteConfidencialEmpleado from '../empleados/ReporteConfidencialEmpleado';
import SoporteTI from '../common/SoporteTI';
import Mensajes from '../comunicacion/Mensajes';
import Perfil from '../common/Perfil';

import { getPsicologaPrincipal } from '../../utils/psicologa';

export default function EmpleadoLayout({ user, globals, actions }) {
  const { usuarios: USERS } = useGlobal();

  const { encuestas, mensajes, vacaciones, permisos, reconocimientos, checadasHoy, horarios } = globals;
  const { addEncuesta, sendMensaje, addSolicitudEmpleadoRH, addReporteConfidencial, marcarMensajesLeidos, registrarChecada } = actions;
  const navigate = useNavigate();

  const userMensajes = mensajes.filter((m) => m.de === user?.id || m.para === user?.id);
  const psicologaId = getPsicologaPrincipal(USERS)?.id || null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          <Routes>
            <Route path="inicio" element={<InicioEmpleado user={user} encuestas={encuestas} mensajes={userMensajes} setActive={(view) => navigate(`/empleado/${view}`)} />} />
            <Route path="checador" element={<ChecadorEmpleado user={user} checadasHoy={checadasHoy} horarios={horarios} onChecar={registrarChecada} />} />
            <Route path="encuesta" element={<EncuestaEmpleado user={user} encuestas={encuestas} onSubmit={addEncuesta}/>} />
            <Route path="historial" element={<HistorialEmpleado user={user} encuestas={encuestas} />} />
            <Route path="permisosempleado" element={<PermisosEmpleado user={user} vacaciones={vacaciones} permisos={permisos} onEnviarSolicitudEmpleado={addSolicitudEmpleadoRH}/>} />
            <Route path="reconocimientos" element={<ReconocimientosEmpleado user={user} reconocimientos={reconocimientos} />} />
            <Route path="reporteconfidencial" element={<ReporteConfidencialEmpleado user={user} onSubmit={addReporteConfidencial} />} />
            <Route path="soporte" element={<SoporteTI user={user} />} />
            <Route path="mensajes" element={<Mensajes user={user} mensajes={userMensajes} onSend={(msg)=>sendMensaje({...msg,para:psicologaId})} onMarkRead={marcarMensajesLeidos}/>} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="inicio" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
