import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import HRDashboard from '../dashboards/HRDashboard';
import VacacionesRH from '../rh/VacacionesRH';
import PermisosRH from '../rh/PermisosRH';
import DescuentosRH from '../rh/DescuentosRH';
import AsistenciaPanel from '../asistencia/AsistenciaPanel';
import ChecadorEmpleado from '../asistencia/ChecadorEmpleado';
import EnrolarRostros from '../asistencia/EnrolarRostros';
import GestionHorarios from '../admin/GestionHorarios';
import ImportarHorarios from '../admin/ImportarHorarios';
import Calibracion from '../admin/Calibracion';
import CalendarioRH from '../rh/CalendarioRH';
import EventosPersonal from '../empleados/EventosPersonal';
import ReconocimientosGestion from '../rh/ReconocimientosGestion';
import ReportesRH from '../rh/ReportesRH';
import GestionUsuarios from '../admin/GestionUsuarios';
import GestionSucursales from '../admin/GestionSucursales';
import GestionEncuestas from '../admin/GestionEncuestas';
import EmpleadosList from '../empleados/EmpleadosList';
import ExpedienteIntegral from '../empleados/ExpedienteIntegral';
import Reportes from '../rh/Reportes';
import AIEngine from '../ia/AIEngine';
import Config from '../settings/Config';
import BolsaTrabajo from '../rh/BolsaTrabajo';
import Perfil from '../common/Perfil';
import SoporteTI from '../common/SoporteTI';
import AvisoPush from '../asistencia/AvisoPush';
import { useAvisoPush } from '../../hooks/useAvisoPush';
import AvisosPanel from '../avisos/AvisosPanel';

export default function HRLayout({ user, globals, actions }) {
  const { usuarios: USERS, encuestaPreguntas } = useGlobal();

  const { vacaciones, permisos, descuentos, calendarioExtra, reconocimientos, encuestas, mensajes, notas, reportesConfidenciales, archivosExpediente, horarios, setHorarios, avisos, checadasHoy } = globals;
  const { updateVacacionEstado, updatePermisoEstado, updateDescuentoEstado, addDescuento, addReconocimiento, subirArchivoExpediente, addAviso, updateAviso, deleteAviso, justificarFalta, registrarChecada } = actions;
  const { ofrecerPush, activarAvisos, cerrarOfertaPush } = useAvisoPush();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main-inner">
          {ofrecerPush && <AvisoPush onActivar={activarAvisos} onCerrar={cerrarOfertaPush} />}
          <Routes>
            <Route path="dashboard" element={<HRDashboard users={USERS} />} />
            <Route path="ai" element={<AIEngine encuestas={encuestas} mensajes={mensajes} notas={notas} userRole="rh" permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales}/>} />
            <Route path="empleados" element={<EmpleadosList encuestas={encuestas} notas={notas} role="rh" currentUser={user} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="usuarios" element={<GestionUsuarios />} />
            <Route path="asistencia" element={<AsistenciaPanel usuarios={USERS} horarios={horarios} permisos={permisos} vacaciones={vacaciones} puedeAnular puedeJustificar onJustificarFalta={justificarFalta} />} />
            <Route path="checador" element={<ChecadorEmpleado user={user} checadasHoy={checadasHoy} horarios={horarios} permisos={permisos} onChecar={registrarChecada} />} />
            <Route path="horarios" element={<GestionHorarios usuarios={USERS} horarios={horarios} setHorarios={setHorarios} />} />
            <Route path="importar-horarios" element={<ImportarHorarios usuarios={USERS} />} />
            <Route path="calibracion" element={<Calibracion usuarios={USERS} />} />
            <Route path="rostros" element={<EnrolarRostros usuarios={USERS} />} />
            <Route path="vacaciones" element={<VacacionesRH vacaciones={vacaciones} onUpdateEstado={updateVacacionEstado} />} />
            <Route path="permisos" element={<PermisosRH permisos={permisos} onUpdateEstado={updatePermisoEstado} horarios={horarios} />} />
            <Route path="descuentos" element={<DescuentosRH descuentos={descuentos} empleados={USERS} user={user} onUpdateEstado={updateDescuentoEstado} onAddDescuento={addDescuento} />} />
            <Route path="calendario" element={<CalendarioRH vacaciones={vacaciones} permisos={permisos} eventosExtra={calendarioExtra} />} />
            <Route path="eventospersonal" element={<EventosPersonal users={USERS} />} />
            <Route path="reconocimientos" element={<ReconocimientosGestion users={USERS} reconocimientos={reconocimientos} onAdd={addReconocimiento} currentUser={user} />} />
            <Route path="reportesrh" element={<ReportesRH vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} />} />
            <Route path="bolsa" element={<BolsaTrabajo />} />
            <Route path="sucursales" element={<GestionSucursales />} />
            <Route path="expedientes" element={<ExpedienteIntegral users={USERS} encuestas={encuestas} mensajes={mensajes} notas={notas} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} currentUser={user} archivosExpediente={archivosExpediente} onSubirArchivoExpediente={subirArchivoExpediente} />} />
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
