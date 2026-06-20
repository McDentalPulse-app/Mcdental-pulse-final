import React from 'react';
import { useGlobal } from "../../contexts/GlobalContext";
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import HRDashboard from '../dashboards/HRDashboard';
import VacacionesRH from '../rh/VacacionesRH';
import DescuentosRH from '../rh/DescuentosRH';
import CalendarioRH from '../rh/CalendarioRH';
import EventosPersonal from '../empleados/EventosPersonal';
import ReconocimientosGestion from '../rh/ReconocimientosGestion';
import ReportesRH from '../rh/ReportesRH';
import GestionUsuarios from '../admin/GestionUsuarios';
import EmpleadosList from '../empleados/EmpleadosList';

export default function HRLayout({ user, globals, actions }) {
  const { usuarios: USERS } = useGlobal();

  const { vacaciones, permisos, descuentos, calendarioExtra, reconocimientos, encuestas, notas, reportesConfidenciales } = globals;
  const { updateVacacionEstado, updateDescuentoEstado, addDescuento, addReconocimiento } = actions;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", background: "linear-gradient(135deg, #f4fbf9 0%, #f8fafc 42%, #ffffff 100%)", color: "#0f172a" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "34px 38px", overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>
        <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto", overflowX: "hidden" }}>
          <Routes>
            <Route path="dashboard" element={<HRDashboard users={USERS} />} />
            <Route path="empleados" element={<EmpleadosList encuestas={encuestas} notas={notas} role="rh" currentUser={user} vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} reconocimientos={reconocimientos} reportesConfidenciales={reportesConfidenciales} />} />
            <Route path="usuarios" element={<GestionUsuarios />} />
            <Route path="vacaciones" element={<VacacionesRH vacaciones={vacaciones} onUpdateEstado={updateVacacionEstado} />} />
            <Route path="descuentos" element={<DescuentosRH descuentos={descuentos} empleados={USERS} user={user} onUpdateEstado={updateDescuentoEstado} onAddDescuento={addDescuento} />} />
            <Route path="calendario" element={<CalendarioRH vacaciones={vacaciones} permisos={permisos} eventosExtra={calendarioExtra} />} />
            <Route path="eventospersonal" element={<EventosPersonal users={USERS} />} />
            <Route path="reconocimientos" element={<ReconocimientosGestion users={USERS} reconocimientos={reconocimientos} onAdd={addReconocimiento} currentUser={user} />} />
            <Route path="reportesrh" element={<ReportesRH vacaciones={vacaciones} permisos={permisos} descuentos={descuentos} />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
