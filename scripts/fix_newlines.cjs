const fs = require('fs');

function fixNewlines(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\\n/g, '\n');
  fs.writeFileSync(filePath, content);
  console.log('Fixed', filePath);
}

fixNewlines('src/components/empleados/EmpleadosList.jsx');
fixNewlines('src/components/psicologia/PsicologaSeguimiento.jsx');
fixNewlines('src/components/common/Badge.jsx');
fixNewlines('src/components/layout/Sidebar.jsx');
fixNewlines('src/components/common/KPI.jsx');
fixNewlines('src/components/ia/AIEngine.jsx');

console.log('All newlines fixed.');
