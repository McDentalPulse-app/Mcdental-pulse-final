import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate } from 'react-router-dom';
import Navegacion from './Navegacion';
import PsicologaDashboard from '../dashboards/PsicologaDashboard';
import AIEngine from '../ia/AIEngine';
import PsicologaSeguimiento from '../psicologia/PsicologaSeguimiento';
import ReportesConfidencialesPanel from '../psicologia/ReportesConfidencialesPanel';
import EmpleadosList from '../empleados/EmpleadosList';
import ExpedienteIntegral from '../empleados/ExpedienteIntegral';
import Mensajes from '../comunicacion/Mensajes';
import PaginaReuniones from '../comunicacion/PaginaReuniones';
import GestionUsuarios from '../admin/GestionUsuarios';
import GestionSucursales from '../admin/GestionSucursales';
import GestionEncuestas from '../admin/GestionEncuestas';
import GestionHorarios from '../admin/GestionHorarios';
import ImportarHorarios from '../admin/ImportarHorarios';
import Calibracion from '../admin/Calibracion';
import AsistenciaPanel from '../asistencia/AsistenciaPanel';
import ChecadorEmpleado from '../asistencia/ChecadorEmpleado';
import EnrolarRostros from '../asistencia/EnrolarRostros';
import ReconocimientosGestion from '../rh/ReconocimientosGestion';
import PermisosRH from '../rh/PermisosRH';
import VacacionesRH from '../rh/VacacionesRH';
import PermisosEmpleado from '../empleados/PermisosEmpleado';
import ComisionesRH from '../comisiones/ComisionesRH';
import EventosPersonal from '../empleados/EventosPersonal';
import Reportes from '../rh/Reportes';
import Config from '../settings/Config';
import IntercambiosRH from '../calendario/IntercambiosRH';
import Perfil from '../common/Perfil';
import IdeasMejora from '../common/IdeasMejora';
import SoporteTI from '../common/SoporteTI';
import AvisoPush from '../asistencia/AvisoPush';
import { useAvisoPush } from '../../hooks/useAvisoPush';
import AvisosPanel from '../avisos/AvisosPanel';

import AvisoUbicacion from '../asistencia/AvisoUbicacion';
import { useAvisoUbicacion } from '../../hooks/useAvisoUbicacion';
export default function PsicologaLayout({ user, globals, actions }) {
  const { usuarios: USERS, encuestaPreguntas } = useGlobal();

  const { encuestas, mensajes, notas, permisos, descuentos, comisiones, reconocimientos, reportesConfidenciales, vacaciones, horarios, setHorarios, archivosExpediente, avisos, checadasHoy, festivos, intercambios } = globals;
  const { restablecerPasswordUsuario, addNota, deleteNota, sendMensaje, marcarMensajesLeidos, addReconocimiento, subirArchivoExpediente, eliminarArchivoExpediente, addAviso, updateAviso, deleteAviso, subirVideoAviso, quitarVideoAviso, justificarFalta, updatePermisoEstado, updateVacacionEstado, agendarPropio, revisarComision, registrarChecada, resolverIntercambio, addFestivo, deleteFestivo } = actions;
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
            <Route path="dashboard" element={<PsicologaDashboard encuestas={encuestas} mensajes={mensajes} reportesConfidenciales={reportesConfidenciales} notas={notas} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} />} />
            <Route path="ai" element={<AIEngine encuestas={encuestas} mensajes={mensajes} notas={notas} userRole="psicologa" permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales}/>} />
            {/* La psicóloga (jefa de RH) también aprueba permisos y vacaciones. */}
            <Route path="vacaciones" element={<VacacionesRH vacaciones={vacaciones} onUpdateEstado={updateVacacionEstado} />} />
            <Route path="permisos" element={<PermisosRH permisos={permisos} onUpdateEstado={updatePermisoEstado} horarios={horarios} />} />
            <Route path="intercambios" element={<IntercambiosRH intercambios={intercambios} festivos={festivos} onResolver={resolverIntercambio} onAddFestivo={addFestivo} onDeleteFestivo={deleteFestivo} />} />
            <Route path="mispermisos" element={<PermisosEmpleado user={user} vacaciones={vacaciones} permisos={permisos} horarios={horarios} onEnviarSolicitudEmpleado={agendarPropio} autoAprobar />} />
            <Route path="comisiones" element={<ComisionesRH comisiones={comisiones} onRevisar={revisarComision} />} />
            <Route path="seguimiento" element={<PsicologaSeguimiento encuestas={encuestas} notas={notas} onUpdateNota={addNota} onDeleteNota={deleteNota}/>} />
            <Route path="confidenciales" element={<ReportesConfidencialesPanel reportes={reportesConfidenciales} />} />
            <Route path="empleados" element={<EmpleadosList encuestas={encuestas} notas={notas} role="psicologa" currentUser={user} onRestablecerPassword={restablecerPasswordUsuario} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="expedientes" element={<ExpedienteIntegral users={USERS} encuestas={encuestas} mensajes={mensajes} notas={notas} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} currentUser={user} archivosExpediente={archivosExpediente} onSubirArchivoExpediente={subirArchivoExpediente} onEliminarArchivoExpediente={eliminarArchivoExpediente} />} />
            <Route path="mensajes" element={<Mensajes user={user} mensajes={mensajes} onSend={sendMensaje} onMarkRead={marcarMensajesLeidos}/>} />
            <Route path="reuniones" element={<PaginaReuniones user={user} />} />
            <Route path="usuarios" element={<GestionUsuarios />} />
            <Route path="asistencia" element={<AsistenciaPanel usuarios={USERS} horarios={horarios} permisos={permisos} vacaciones={vacaciones} puedeJustificar onJustificarFalta={justificarFalta} />} />
            <Route path="checador" element={<ChecadorEmpleado user={user} checadasHoy={checadasHoy} horarios={horarios} permisos={permisos} onChecar={registrarChecada} />} />
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
            <Route path="soporte" element={<IdeasMejora user={user} />} />
            <Route path="soporteti" element={<SoporteTI user={user} />} />
            <Route path="avisos" element={<AvisosPanel user={user} avisos={avisos} onAdd={addAviso} onUpdate={updateAviso} onDelete={deleteAviso} onSubirVideo={subirVideoAviso} onQuitarVideo={quitarVideoAviso} />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="/psicologa/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
