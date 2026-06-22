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
import GestionUsuarios from '../admin/GestionUsuarios';

import { semanaActual } from '../../utils/constants';

export default function AdminLayout({ user, globals, actions }) {
  const { usuarios: USERS, encuestaPreguntas: ENCUESTA_PREGUNTAS } = useGlobal();

  const { encuestas, mensajes, notas, permisos, descuentos, reconocimientos, reportesConfidenciales, vacaciones, archivosExpediente } = globals;
  const { restablecerPasswordUsuario, subirArchivoExpediente, addReconocimiento, inicializarUsuariosPassword } = actions;

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
            <Route path="config" element={<Config inicializarUsuariosPassword={inicializarUsuariosPassword} />} />
            <Route path="encuestas" element={<div><h2 style={{ margin:"0 0 20px",fontSize:22,fontWeight:800,color:"#004D40" }}>📋 Gestión de Encuestas</h2><Card><div style={{ fontWeight:700,fontSize:14,color:"#004D40",marginBottom:12 }}>Encuesta activa: {semanaActual}</div><div style={{ fontSize:13,color:"#6b7280",marginBottom:16 }}>{ENCUESTA_PREGUNTAS.length} preguntas · {new Set(encuestas.filter(e=>e.semana===semanaActual).map(e=>e.empleadoId)).size} respuestas</div>{ENCUESTA_PREGUNTAS.map((p,i)=>(<div key={p.id} style={{ padding:"10px 0",borderBottom:"1px solid #f3f4f6",fontSize:13 }}><span style={{ color:"#006D5B",fontWeight:700,marginRight:8 }}>{i+1}.</span><span style={{ color:"#374151" }}>{p.texto}</span><span style={{ color:"#9ca3af",marginLeft:8,fontSize:11 }}>({p.tipo})</span></div>))}<button style={{ marginTop:16,padding:"10px 20px",background:"#006D5B",color:"#fff",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer" }}>+ Crear encuesta</button></Card></div>} />
            <Route path="mensajes" element={<div style={{ padding: 40, textAlign: "center", color: "#64748b" }}><h2 style={{ color: "#004D40" }}>Acceso restringido</h2><p>Este canal es privado y solo está disponible para empleados y psicóloga.</p></div>} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
