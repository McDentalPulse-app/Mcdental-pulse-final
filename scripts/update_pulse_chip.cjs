const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');
let appCss = fs.readFileSync(appCssPath, 'utf8');

// Update .ai-engine-pulse-chip to include transitions
appCss = appCss.replace(/\.ai-engine-pulse-chip\s*\{([\s\S]*?)\}/, (match, p1) => {
  if (p1.includes('transition:')) return match;
  return `.ai-engine-pulse-chip {${p1}\n  transition: transform 0.2s ease, box-shadow 0.2s ease;\n  overflow: hidden;\n}`;
});

// Add the hover rules if not exists
if (!appCss.includes('.ai-engine-pulse-chip:hover')) {
  appCss += `
.ai-engine-pulse-chip:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong) !important;
}

.ai-engine-pulse-chip-more {
  max-height: 0;
  opacity: 0;
  font-size: 10px;
  color: var(--text-muted);
  transition: all 0.2s ease;
  overflow: hidden;
  margin-top: 0;
}

.ai-engine-pulse-chip:hover .ai-engine-pulse-chip-more {
  max-height: 20px;
  opacity: 1;
  margin-top: 4px;
}
`;
}

fs.writeFileSync(appCssPath, appCss);
console.log('App.css updated with ai-engine-pulse-chip hover animation.');
