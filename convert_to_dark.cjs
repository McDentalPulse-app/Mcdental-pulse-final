const fs = require('fs');
const path = require('path');

const files = [
  'src/components/psicologia/ReportesConfidencialesPanel.jsx',
  'src/components/psicologia/PsicologaSeguimiento.jsx',
  'src/components/comunicacion/Mensajes.jsx',
  'src/components/empleados/EmpleadosList.jsx',
  'src/components/empleados/ExpedienteIntegral.jsx',
  'src/components/dashboards/PsicologaDashboard.jsx'
];

const basePath = '/home/helminth/Proyects/Mcdental-pulse-final-main/';

files.forEach(file => {
  const fullPath = path.join(basePath, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Background colors
  content = content.replace(/background:\s*['"]#fff['"]/gi, 'background: "rgba(255, 255, 255, 0.05)"');
  content = content.replace(/background:\s*['"]#ffffff['"]/gi, 'background: "rgba(255, 255, 255, 0.05)"');
  content = content.replace(/background:\s*['"]white['"]/gi, 'background: "rgba(255, 255, 255, 0.05)"');
  content = content.replace(/background:\s*['"]#f8fafc['"]/gi, 'background: "rgba(0, 0, 0, 0.2)"');
  content = content.replace(/background:\s*['"]#f1f5f9['"]/gi, 'background: "rgba(0, 0, 0, 0.3)"');
  
  // Text colors
  content = content.replace(/color:\s*['"]#0f172a['"]/gi, 'color: "#ffffff"');
  content = content.replace(/color:\s*['"]#1e293b['"]/gi, 'color: "var(--text-main)"');
  content = content.replace(/color:\s*['"]#334155['"]/gi, 'color: "var(--text-main)"');
  content = content.replace(/color:\s*['"]#475569['"]/gi, 'color: "var(--text-light)"');
  content = content.replace(/color:\s*['"]#64748b['"]/gi, 'color: "var(--text-muted)"');
  
  // Borders
  content = content.replace(/border:\s*['"]1px solid #e2e8f0['"]/gi, 'border: "1px solid rgba(255,255,255,0.1)"');
  content = content.replace(/borderBottom:\s*['"]1px solid #e2e8f0['"]/gi, 'borderBottom: "1px solid rgba(255,255,255,0.1)"');
  content = content.replace(/borderTop:\s*['"]1px solid #e2e8f0['"]/gi, 'borderTop: "1px solid rgba(255,255,255,0.1)"');
  content = content.replace(/borderRight:\s*['"]1px solid #e2e8f0['"]/gi, 'borderRight: "1px solid rgba(255,255,255,0.1)"');
  content = content.replace(/borderLeft:\s*['"]1px solid #e2e8f0['"]/gi, 'borderLeft: "1px solid rgba(255,255,255,0.1)"');

  fs.writeFileSync(fullPath, content);
  console.log('Converted:', file);
});
