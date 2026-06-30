const fs = require('fs');
const css = fs.readFileSync('./src/App.css', 'utf8');

// Basic bracket balancing check
let open = 0;
let lineNum = 1;
for (let i = 0; i < css.length; i++) {
  if (css[i] === '\n') lineNum++;
  if (css[i] === '{') open++;
  if (css[i] === '}') {
    open--;
    if (open < 0) {
      console.log('Error: Extra closing bracket at line', lineNum);
      process.exit(1);
    }
  }
}
if (open !== 0) {
  console.log('Error: Unclosed bracket, depth:', open);
  process.exit(1);
}
console.log('CSS brackets are balanced.');
