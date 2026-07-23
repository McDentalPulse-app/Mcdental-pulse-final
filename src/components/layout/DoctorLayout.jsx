import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import InicioEmpleado from '../empleados/InicioEmpleado';
import EncuestaEmpleado from '../empleados/EncuestaEmpleado';
import HistorialEmpleado from '../empleados/HistorialEmpleado';
import PermisosEmpleado from '../empleados/PermisosEmpleado';
import ChecadorEmpleado from '../asistencia/ChecadorEmpleado';
import MiRostro from '../asistencia/MiRostro';
import ReconocimientosEmpleado from '../empleados/ReconocimientosEmpleado';
import ReporteConfidencialEmpleado from '../empleados/ReporteConfidencialEmpleado';
import SoporteTI from '../common/SoporteTI';
import Mensajes from '../comunicacion/Mensajes';
import Perfil from '../common/Perfil';
import AvisosPanel from '../avisos/AvisosPanel';
import ComisionesDoctor from '../comisiones/ComisionesDoctor';
import CalendarioIntercambio from '../calendario/CalendarioIntercambio';

import { getPsicologaPrincipal } from '../../utils/psicologa';

// El doctor es un empleado con menús extra (Comisiones, Calendario de intercambio). Este layout
// replica el de empleado para conservar TODO lo suyo (checador, encuesta, permisos, mensajes,
// rostro…) y aquí se irán colgando las rutas propias del doctor.
export default function DoctorLayout({ user, globals, actions }) {
  const { usuarios: USERS } = useGlobal();

  const { encuestas, mensajes, vacaciones, permisos, reconocimientos, checadasHoy, horarios, avisos, comisiones, festivos, intercambios, destinosOcupados } = globals;
  const { addEncuesta, sendMensaje, addSolicitudEmpleadoRH, addReporteConfidencial, marcarMensajesLeidos, registrarChecada, crearComision, solicitarIntercambio } = actions;
  const navigate = useNavigate();

  const userMensajes = mensajes.filter((m) => m.de === user?.id || m.para === user?.id);
  const psicologaId = getPsicologaPrincipal(USERS)?.id || null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          <Routes>
            <Route path="inicio" element={<InicioEmpleado user={user} encuestas={encuestas} mensajes={userMensajes} setActive={(view) => navigate(`/doctor/${view}`)} />} />
            <Route path="checador" element={<ChecadorEmpleado user={user} checadasHoy={checadasHoy} horarios={horarios} permisos={permisos} onChecar={registrarChecada} />} />
            <Route path="rostro" element={<MiRostro user={user} />} />
            <Route path="encuesta" element={<EncuestaEmpleado user={user} encuestas={encuestas} onSubmit={addEncuesta}/>} />
            <Route path="historial" element={<HistorialEmpleado user={user} encuestas={encuestas} />} />
            <Route path="permisosempleado" element={<PermisosEmpleado user={user} vacaciones={vacaciones} permisos={permisos} horarios={horarios} onEnviarSolicitudEmpleado={addSolicitudEmpleadoRH}/>} />
            <Route path="comisiones" element={<ComisionesDoctor user={user} comisiones={comisiones} onCrear={crearComision} />} />
            <Route path="calendario" element={<CalendarioIntercambio user={user} festivos={festivos} intercambios={intercambios} destinosOcupados={destinosOcupados} onSolicitar={solicitarIntercambio} />} />
            <Route path="reconocimientos" element={<ReconocimientosEmpleado user={user} reconocimientos={reconocimientos} />} />
            <Route path="reporteconfidencial" element={<ReporteConfidencialEmpleado user={user} onSubmit={addReporteConfidencial} />} />
            <Route path="soporte" element={<SoporteTI user={user} />} />
            <Route path="mensajes" element={<Mensajes user={user} mensajes={userMensajes} onSend={(msg)=>sendMensaje({...msg,para:psicologaId})} onMarkRead={marcarMensajesLeidos}/>} />
            <Route path="avisos" element={<AvisosPanel user={user} avisos={avisos} />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="inicio" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
