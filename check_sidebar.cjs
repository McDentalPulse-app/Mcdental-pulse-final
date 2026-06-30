const fs = require('fs');
const css = fs.readFileSync('src/App.css', 'utf8');

const regex = /\.sidebar-[a-zA-Z0-9_-]+\s*\{[^}]+\}/g;
const matches = css.match(regex);
if (matches) {
  matches.forEach(m => console.log(m));
}
