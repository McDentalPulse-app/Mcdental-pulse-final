const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../src');

// Helper to get files
function getFiles(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, ext));
    } else if (filePath.endsWith(ext)) {
      results.push(filePath);
    }
  }
  return results;
}

// ---------------------------------------------------------
// FIX: INLINE SEMAFORO CONSTANTS (since theme.js is gone)
// ---------------------------------------------------------
const semaforoDefs = `
const semaforoColor = {
  verde: 'var(--mc-semaforo-verde, #10b981)',
  amarillo: 'var(--mc-semaforo-amarillo, #f59e0b)',
  rojo: 'var(--mc-semaforo-rojo, #ef4444)',
  default: 'var(--text-muted, #64748b)'
};
const semaforoBg = {
  verde: 'rgba(16, 185, 129, 0.15)',
  amarillo: 'rgba(245, 158, 11, 0.15)',
  rojo: 'rgba(239, 68, 68, 0.15)',
  default: 'var(--bg-subtle, #f8fafc)'
};
const semaforoLabel = {
  verde: 'Verde (Estable)',
  amarillo: 'Amarillo (Precaución)',
  rojo: 'Rojo (Atención Crítica)',
  default: 'Sin evaluación'
};
`;

const jsxFiles = getFiles(root, '.jsx');
for (const file of jsxFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Remove theme imports (if any remain)
  content = content.replace(/^import\s+.*?\s+from\s+['"](?:\.\.\/|\.\/)*config\/theme['"];?\s*$/gm, '');

  // Inject semaforo defs if used
  if (!content.includes('const semaforoColor') && 
     (content.includes('semaforoColor') || content.includes('semaforoBg') || content.includes('semaforoLabel'))) {
    // Inject right after the last import
    const importMatch = content.match(/import.*?[\r\n]/g);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      content = content.replace(lastImport, lastImport + '\\n' + semaforoDefs);
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('✅ Injected semaforo constants into', path.basename(file));
  }
}

// ---------------------------------------------------------
// FASE 3: COMPONENTES Y LAYOUT
// ---------------------------------------------------------

// 7. Create AppLayout.jsx
const appLayoutPath = path.join(root, 'components/layout/AppLayout.jsx');
const appLayoutContent = `import React, { Suspense } from "react";
import { Routes } from "react-router-dom";
import Sidebar from "./Sidebar";
import Loader from "../ui/Loader";

const AppLayout = ({ children }) => (
  <div className="app-shell">
    <Sidebar />
    <main className="app-main">
      <div className="app-main-inner">
        <Suspense fallback={<Loader />}>
          <Routes>{children}</Routes>
        </Suspense>
      </div>
    </main>
  </div>
);

export default AppLayout;
`;
fs.writeFileSync(appLayoutPath, appLayoutContent);
console.log('✅ Created AppLayout.jsx');

// 8. Refactor AdminLayout
const adminLayoutPath = path.join(root, 'components/layout/AdminLayout.jsx');
const adminLayoutContent = `import React from "react";
import { Route } from "react-router-dom";
import AppLayout from "./AppLayout";
import AdminDashboard from "../dashboards/AdminDashboard";
import AIEngine from "../ia/AIEngine";
import EmpleadosList from "../empleados/EmpleadosList";
import GestionUsuarios from "../admin/GestionUsuarios";
import ExpedienteIntegral from "../empleados/ExpedienteIntegral";
import ReconocimientosGestion from "../rh/ReconocimientosGestion";
import EventosPersonal from "../empleados/EventosPersonal";
import GestionEncuestas from "../admin/GestionEncuestas";
import Reportes from "../rh/Reportes";
import ReportesConfidencialesPanel from "../psicologia/ReportesConfidencialesPanel";
import Config from "../settings/Config";
import Mensajes from "../comunicacion/Mensajes";
import { useGlobal } from "../../contexts/GlobalContext";

const AdminLayout = ({ user, globals, actions }) => {
  const { encuestas, mensajes } = useGlobal();
  return (
    <AppLayout>
      <Route path="dashboard" element={<AdminDashboard encuestas={encuestas} mensajes={mensajes} />} />
      <Route path="ai" element={<AIEngine />} />
      <Route path="empleados" element={<EmpleadosList globals={globals} actions={actions} />} />
      <Route path="usuarios" element={<GestionUsuarios user={user} globals={globals} actions={actions} />} />
      <Route path="expedientes" element={<ExpedienteIntegral globals={globals} actions={actions} />} />
      <Route path="reconocimientos" element={<ReconocimientosGestion globals={globals} actions={actions} />} />
      <Route path="eventospersonal" element={<EventosPersonal globals={globals} />} />
      <Route path="encuestas" element={<GestionEncuestas globals={globals} actions={actions} />} />
      <Route path="reportes" element={<Reportes globals={globals} />} />
      <Route path="confidenciales" element={<ReportesConfidencialesPanel globals={globals} actions={actions} />} />
      <Route path="config" element={<Config globals={globals} actions={actions} />} />
      <Route path="mensajes" element={<Mensajes user={user} />} />
      <Route index element={<AdminDashboard encuestas={encuestas} mensajes={mensajes} />} />
    </AppLayout>
  );
};

export default AdminLayout;
`;
fs.writeFileSync(adminLayoutPath, adminLayoutContent);
console.log('✅ Updated AdminLayout.jsx');

// Refactor PsicologaLayout
const psicoLayoutPath = path.join(root, 'components/layout/PsicologaLayout.jsx');
if (fs.existsSync(psicoLayoutPath)) {
  let content = fs.readFileSync(psicoLayoutPath, 'utf8');
  content = content.replace(/import Sidebar from ["'].\/Sidebar["'];/, 'import AppLayout from "./AppLayout";');
  content = content.replace(/<div className="app-shell">[\s\S]*?<main className="app-main">[\s\S]*?<div className="app-main-inner">[\s\S]*?<Suspense fallback={<Loader \/>}>[\s\S]*?<Routes>/, '<AppLayout>');
  content = content.replace(/<\/Routes>[\s\S]*?<\/Suspense>[\s\S]*?<\/div>[\s\S]*?<\/main>[\s\S]*?<\/div>/, '</AppLayout>');
  fs.writeFileSync(psicoLayoutPath, content);
  console.log('✅ Updated PsicologaLayout.jsx');
}

// Refactor HRLayout
const hrLayoutPath = path.join(root, 'components/layout/HRLayout.jsx');
if (fs.existsSync(hrLayoutPath)) {
  let content = fs.readFileSync(hrLayoutPath, 'utf8');
  content = content.replace(/import Sidebar from ["'].\/Sidebar["'];/, 'import AppLayout from "./AppLayout";');
  content = content.replace(/<div className="app-shell">[\s\S]*?<main className="app-main">[\s\S]*?<div className="app-main-inner">[\s\S]*?<Suspense fallback={<Loader \/>}>[\s\S]*?<Routes>/, '<AppLayout>');
  content = content.replace(/<\/Routes>[\s\S]*?<\/Suspense>[\s\S]*?<\/div>[\s\S]*?<\/main>[\s\S]*?<\/div>/, '</AppLayout>');
  fs.writeFileSync(hrLayoutPath, content);
  console.log('✅ Updated HRLayout.jsx');
}

// Refactor EmpleadoLayout
const empLayoutPath = path.join(root, 'components/layout/EmpleadoLayout.jsx');
if (fs.existsSync(empLayoutPath)) {
  let content = fs.readFileSync(empLayoutPath, 'utf8');
  content = content.replace(/import Sidebar from ["'].\/Sidebar["'];/, 'import AppLayout from "./AppLayout";');
  content = content.replace(/<div className="app-shell">[\s\S]*?<main className="app-main">[\s\S]*?<div className="app-main-inner">[\s\S]*?<Suspense fallback={<Loader \/>}>[\s\S]*?<Routes>/, '<AppLayout>');
  content = content.replace(/<\/Routes>[\s\S]*?<\/Suspense>[\s\S]*?<\/div>[\s\S]*?<\/main>[\s\S]*?<\/div>/, '</AppLayout>');
  fs.writeFileSync(empLayoutPath, content);
  console.log('✅ Updated EmpleadoLayout.jsx');
}

// 9. Update Sidebar.jsx
const sidebarPath = path.join(root, 'components/layout/Sidebar.jsx');
if (fs.existsSync(sidebarPath)) {
  let content = fs.readFileSync(sidebarPath, 'utf8');
  content = content.replace(
    /const active = location\.pathname\.split\(['"]\/['"]\)\.pop\(\) \|\| ["']dashboard["'];/,
    'const segments = location.pathname.split("/");\\n  const active = segments[2] || "dashboard";'
  );
  fs.writeFileSync(sidebarPath, content);
  console.log('✅ Updated Sidebar.jsx active state detection');
}

// 10. Card interactivity classes
const empListPath = path.join(root, 'components/empleados/EmpleadosList.jsx');
if (fs.existsSync(empListPath)) {
  let content = fs.readFileSync(empListPath, 'utf8');
  // Find <div className="mc-card"> or <div className="mc-card "> inside emp-card-wrap
  content = content.replace(/className=(['"])mc-card\1/g, 'className="mc-card mc-card--interactive"');
  content = content.replace(/className=(['"])mc-card\s/g, 'className="mc-card mc-card--interactive ');
  fs.writeFileSync(empListPath, content);
  console.log('✅ Updated EmpleadosList.jsx with interactive cards');
}

const psicoSegPath = path.join(root, 'components/psicologia/PsicologaSeguimiento.jsx');
if (fs.existsSync(psicoSegPath)) {
  let content = fs.readFileSync(psicoSegPath, 'utf8');
  // The user says "busca los elementos con className 'psico-emp-card' y agrega 'mc-card--interactive' a su className"
  content = content.replace(/className=(['"])psico-emp-card\1/g, 'className="psico-emp-card mc-card--interactive"');
  content = content.replace(/className=(['"])psico-emp-card\s/g, 'className="psico-emp-card mc-card--interactive ');
  fs.writeFileSync(psicoSegPath, content);
  console.log('✅ Updated PsicologaSeguimiento.jsx with interactive cards');
}

console.log('✅ Phase 3 script complete.');
