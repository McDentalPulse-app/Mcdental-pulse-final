const fs = require('fs');
const path = './src/index.css';

let css = fs.readFileSync(path, 'utf8');

// Replace the specificities just to be perfectly standard
css = css.replace(/:root\[data-theme="light"\]/g, 'html[data-theme="light"]');
css = css.replace(/:root\[data-theme="dark"\]/g, 'html[data-theme="dark"]');

// Remove the base fallback for :root
// It starts at /* Base fallback for :root if no data-theme */
// and ends at the next closing brace after --mc-blanco: var(--bg-card);
const fallbackRegex = /\/\* Base fallback for :root if no data-theme \*\/[\s\S]*?--mc-blanco:\s*var\(--bg-card\);\s*\n\}/;
css = css.replace(fallbackRegex, '');

fs.writeFileSync(path, css);
console.log('Removed fallback root and updated selectors in index.css');
