import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Navegacion from './Navegacion';
import InicioEmpleado from '../empleados/InicioEmpleado';
import EncuestaEmpleado from '../empleados/EncuestaEmpleado';
import HistorialEmpleado from '../empleados/HistorialEmpleado';
import PermisosEmpleado from '../empleados/PermisosEmpleado';
import ChecadorEmpleado from '../asistencia/ChecadorEmpleado';
import MiClinica from '../asistencia/MiClinica';
import MiRostro from '../asistencia/MiRostro';
import ReconocimientosEmpleado from '../empleados/ReconocimientosEmpleado';
import ReporteConfidencialEmpleado from '../empleados/ReporteConfidencialEmpleado';
import SoporteTI from '../common/SoporteTI';
import Mensajes from '../comunicacion/Mensajes';
import Perfil from '../common/Perfil';
import AvisosPanel from '../avisos/AvisosPanel';
import ComisionesDoctor from '../comisiones/ComisionesDoctor';
import CalendarioIntercambio from '../calendario/CalendarioIntercambio';


import AvisoUbicacion from '../asistencia/AvisoUbicacion';
import { useAvisoUbicacion } from '../../hooks/useAvisoUbicacion';
import AvisoGeocerca from '../asistencia/AvisoGeocerca';
import { useAvisoGeocerca } from '../../hooks/useAvisoGeocerca';
// El doctor es un empleado con menús extra (Comisiones, Calendario de intercambio). Este layout
// replica el de empleado para conservar TODO lo suyo (checador, encuesta, permisos, mensajes,
// rostro…) y aquí se irán colgando las rutas propias del doctor.
export default function DoctorLayout({ user, globals, actions }) {
  const { encuestas, mensajes, vacaciones, permisos, reconocimientos, checadasHoy, horarios, avisos, comisiones, festivos, intercambios, destinosOcupados } = globals;
  const { addEncuesta, sendMensaje, addSolicitudEmpleadoRH, addReporteConfidencial, marcarMensajesLeidos, registrarChecada, crearComision, solicitarIntercambio } = actions;
  const navigate = useNavigate();

  // Quien atiende Soporte TI necesita TODO el canal de soporte, incluido lo que otros empleados
  // mandaron al buzón: esos mensajes no van dirigidos a él (`para` es nulo), así que sin esta
  // tercera condición la RLS se los entregaría y este filtro los tiraría justo después.
  const userMensajes = mensajes.filter(
    (m) => m.de === user?.id || m.para === user?.id || (user?.soporteTi && m.canal === "soporte"),
  );

  const { ofrecerUbicacion, estadoUbicacion, activarUbicacion, cerrarAviso } = useAvisoUbicacion();
  const { faltaGeocerca, nombreClinica } = useAvisoGeocerca(user);


  return (
    <div className="app-shell">
      <Navegacion />
      <main className="app-main">
        <div className="app-main-inner">
          {faltaGeocerca && <AvisoGeocerca nombreClinica={nombreClinica} ruta="/doctor/miclinica" />}
          {ofrecerUbicacion && (
            <AvisoUbicacion estado={estadoUbicacion} onActivar={activarUbicacion} onCerrar={cerrarAviso} />
          )}
          <Routes>
            <Route path="inicio" element={<InicioEmpleado user={user} encuestas={encuestas} mensajes={userMensajes} setActive={(view) => navigate(`/doctor/${view}`)} />} />
            <Route path="checador" element={<ChecadorEmpleado user={user} checadasHoy={checadasHoy} horarios={horarios} permisos={permisos} encuestas={encuestas} onChecar={registrarChecada} />} />
            <Route path="rostro" element={<MiRostro user={user} />} />
            {/* Igual que en empleado: la ruta se monta para todos, pero el menú solo la
                ofrece a quien tenga el permiso y la RPC rechaza a quien no (mig. 103). */}
            <Route path="miclinica" element={<MiClinica user={user} />} />
            <Route path="encuesta" element={<EncuestaEmpleado user={user} encuestas={encuestas} onSubmit={addEncuesta}/>} />
            <Route path="historial" element={<HistorialEmpleado user={user} encuestas={encuestas} />} />
            <Route path="permisosempleado" element={<PermisosEmpleado user={user} vacaciones={vacaciones} permisos={permisos} horarios={horarios} onEnviarSolicitudEmpleado={addSolicitudEmpleadoRH}/>} />
            <Route path="comisiones" element={<ComisionesDoctor user={user} comisiones={comisiones} onCrear={crearComision} />} />
            <Route path="calendario" element={<CalendarioIntercambio user={user} festivos={festivos} intercambios={intercambios} destinosOcupados={destinosOcupados} onSolicitar={solicitarIntercambio} />} />
            <Route path="reconocimientos" element={<ReconocimientosEmpleado user={user} reconocimientos={reconocimientos} />} />
            <Route path="reporteconfidencial" element={<ReporteConfidencialEmpleado user={user} onSubmit={addReporteConfidencial} />} />
            <Route path="soporte" element={<SoporteTI />} />
            {/* Igual que en EmpleadoLayout: el destinatario lo decide Mensajes, porque desde la
                mig. 094 hay dos conversaciones y la de Soporte TI va sin destinatario. */}
            <Route path="mensajes" element={<Mensajes user={user} mensajes={userMensajes} onSend={sendMensaje} onMarkRead={marcarMensajesLeidos}/>} />
            <Route path="avisos" element={<AvisosPanel user={user} avisos={avisos} />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="/doctor/inicio" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
