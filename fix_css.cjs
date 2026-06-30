const fs = require('fs');
const path = './src/index.css';

let css = fs.readFileSync(path, 'utf8');

// The issue is CSS specificity and order. The fallback `:root` must come before `[data-theme]`.
// Let's replace the selectors to use `:root[data-theme="light"]` which has higher specificity.
css = css.replace(/\[data-theme="light"\] \{/g, ':root[data-theme="light"] {');
css = css.replace(/\[data-theme="dark"\] \{/g, ':root[data-theme="dark"] {');

fs.writeFileSync(path, css);
console.log('Fixed CSS specificity in index.css');
