const fs = require('fs');
const path = './src/index.css';

let css = fs.readFileSync(path, 'utf8');

// Use just [data-theme="light"] to be as simple as possible
css = css.replace(/html\[data-theme="light"\]/g, '[data-theme="light"]');
css = css.replace(/html\[data-theme="dark"\]/g, '[data-theme="dark"]');

fs.writeFileSync(path, css);
console.log('Selectors simplified in index.css');
