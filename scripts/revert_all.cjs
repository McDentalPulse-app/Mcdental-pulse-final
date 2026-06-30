const fs = require('fs');
const path = require('path');

const filesToRevert = [
  'src/App.css',
  'src/App.jsx',
  'src/components/admin/GestionUsuarios.jsx',
  'src/components/auth/Login.jsx',
  'src/components/common/Badge.jsx',
  'src/components/common/KPI.jsx',
  'src/components/common/StatCard.jsx',
  'src/components/dashboards/PsicologaDashboard.jsx',
  'src/components/empleados/EmpleadosList.jsx',
  'src/components/empleados/InicioEmpleado.jsx',
  'src/components/ia/AIEngine.jsx',
  'src/components/layout/AdminLayout.jsx',
  'src/components/layout/EmpleadoLayout.jsx',
  'src/components/layout/HRLayout.jsx',
  'src/components/layout/PsicologaLayout.jsx',
  'src/components/layout/Sidebar.jsx',
  'src/components/psicologia/PsicologaSeguimiento.jsx',
  'src/components/psicologia/ReportesConfidencialesPanel.jsx',
  'src/components/ui/Icon.jsx',
  'src/config/firebase.js',
  'src/contexts/AuthContext.jsx',
  'src/index.css',
  'src/main.jsx',
  'src/utils/pulseScore.js'
];

const srcDir = '/home/helminth/Downloads/Mcdental-pulse-final-main';
const destDir = '/home/helminth/Proyects/Mcdental-pulse-final-main';

filesToRevert.forEach(file => {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);
  
  try {
    if (fs.existsSync(srcPath)) {
      // Ensure destination directory exists
      const destFileDir = path.dirname(destPath);
      if (!fs.existsSync(destFileDir)) {
        fs.mkdirSync(destFileDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`Reverted: ${file}`);
    } else {
      console.warn(`Source file does not exist: ${srcPath}`);
    }
  } catch (err) {
    console.error(`Failed to revert ${file}:`, err);
  }
});
