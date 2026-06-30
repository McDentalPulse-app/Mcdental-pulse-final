const fs = require('fs');
const path = './src/App.css';

let css = fs.readFileSync(path, 'utf8');

// Replace dark mode specific hardcoded colors with theme variables
css = css.replace(/background:\s*rgba\(15,\s*23,\s*42,\s*0\.5\);/g, 'background: var(--bg-card);');
css = css.replace(/background:\s*rgba\(0,\s*0,\s*0,\s*0\.2\);/g, 'background: var(--bg-subtle);');
css = css.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\);/g, 'background: var(--bg-subtle);');
css = css.replace(/border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.1\);/g, 'border: 1px solid var(--border-color);');
css = css.replace(/border-bottom:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.1\);/g, 'border-bottom: 1px solid var(--border-color);');
css = css.replace(/border-top:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.1\);/g, 'border-top: 1px solid var(--border-color);');
css = css.replace(/color:\s*#fff;/g, 'color: var(--text-inverse);'); /* wait, #fff could be text-main or text-inverse */
css = css.replace(/color:\s*#ffffff;/g, 'color: var(--text-inverse);');

fs.writeFileSync(path, css);
console.log('App.css updated successfully!');
