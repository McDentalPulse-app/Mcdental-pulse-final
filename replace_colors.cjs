const fs = require('fs');
const path = './src/App.css';

let css = fs.readFileSync(path, 'utf8');

// Replace dark mode specific hardcoded backgrounds with theme variables
css = css.replace(/background:\s*rgba\(15,\s*23,\s*42,\s*0\.5\);/g, 'background: var(--bg-card);');
css = css.replace(/background:\s*rgba\(0,\s*0,\s*0,\s*0\.2\);/g, 'background: var(--bg-subtle);');
css = css.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\);/g, 'background: var(--bg-subtle);');

// Replace standard dark backgrounds
css = css.replace(/background-color:\s*#0f172a;/g, 'background-color: var(--bg-card);');
css = css.replace(/background:\s*#0f172a;/g, 'background: var(--bg-card);');

fs.writeFileSync(path, css);
console.log('App.css updated successfully!');
