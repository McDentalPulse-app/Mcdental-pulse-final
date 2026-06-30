const fs = require('fs');
const path = require('path');

const filePaths = [
  path.join(__dirname, '../src/components/ia/AIEngine.jsx'),
  path.join(__dirname, '../src/utils/pulseScore.js'),
  path.join(__dirname, '../src/components/empleados/EmpleadosList.jsx'),
  path.join(__dirname, '../src/components/empleados/InicioEmpleado.jsx'),
  path.join(__dirname, '../src/components/psicologia/PsicologaSeguimiento.jsx'),
  path.join(__dirname, '../src/components/dashboards/PsicologaDashboard.jsx'),
  path.join(__dirname, '../src/components/comunicacion/Mensajes.jsx'),
  path.join(__dirname, '../src/components/rh/Reportes.jsx'),
  path.join(__dirname, '../src/components/admin/GestionEncuestas.jsx'),
  path.join(__dirname, '../src/components/empleados/HistorialEmpleado.jsx'),
  path.join(__dirname, '../src/utils/encuestaDetail.js')
];

for (const fp of filePaths) {
  if (fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    
    // Fix localeCompare crashes (a.semana.localeCompare(b.semana) -> (a.semana||"").localeCompare(b.semana||""))
    content = content.replace(/(\w+)\.semana\.localeCompare\(([^)]+)\)/g, '($1.semana || "").localeCompare($2 || "")');
    content = content.replace(/([^.]+\.semana)\.localeCompare\(([^)]+)\)/g, '($1 || "").localeCompare($2 || "")');

    // Fix a.fecha.localeCompare(b.fecha) -> (a.fecha||"").localeCompare(b.fecha||"")
    content = content.replace(/(\w+)\.fecha\.localeCompare\(([^)]+)\)/g, '($1.fecha || "").localeCompare($2 || "")');

    // Fix emp.name.split(" ") -> (emp.name || "").split(" ")
    content = content.replace(/(\w+)\.name\.split\(/g, '($1.name || "").split(');

    fs.writeFileSync(fp, content);
  }
}
console.log('Fixed potential crashes with localeCompare and split.');
