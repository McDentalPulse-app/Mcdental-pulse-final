const fs = require('fs');
const file = 'src/App.css';
let content = fs.readFileSync(file, 'utf8');

// Replace CSS variable backgrounds
content = content.replace(/background(-color)?:\s*var\(--mc-blanco\)/gi, 'background: rgba(15, 23, 42, 0.5)');
content = content.replace(/background(-color)?:\s*var\(--mc-gris-perla\)/gi, 'background: rgba(0, 0, 0, 0.2)');
content = content.replace(/background(-color)?:\s*var\(--mc-gris-fondo\)/gi, 'background: rgba(0, 0, 0, 0.3)');

fs.writeFileSync(file, content);
console.log("App.css variables forced to dark mode.");
