const fs = require('fs');
const path = './src/App.css';

let css = fs.readFileSync(path, 'utf8');

// Replace specific white text colors that correspond to main text
css = css.replace(/color:\s*#fff;/g, 'color: var(--text-main);');
css = css.replace(/color:\s*#ffffff;/g, 'color: var(--text-main);');

// BUT we need to revert buttons, badges, and specifically colored backgrounds back to #fff
// If something has background: var(--mc-verde-oscuro) or var(--mc-aqua) it should keep #fff text
css = css.replace(/background:\s*var\(--mc-verde-oscuro\);\s*color:\s*var\(--text-main\);/g, 'background: var(--mc-verde-oscuro); color: var(--text-inverse);');
css = css.replace(/background-color:\s*var\(--mc-verde-oscuro\);\s*color:\s*var\(--text-main\);/g, 'background-color: var(--mc-verde-oscuro); color: var(--text-inverse);');

fs.writeFileSync(path, css);
console.log('App.css text colors updated successfully!');
