const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');

const fixCss = `

/* ==========================================================================
   ✨ PRIORITY PILL FIX (Appended by AI)
   ========================================================================== */

.ai-premium-pill-absolute {
  background: rgba(0, 0, 0, 0.35) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  backdrop-filter: blur(12px) !important;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
  letter-spacing: 0.5px !important;
  text-transform: uppercase !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  fs.appendFileSync(appCssPath, fixCss);
  console.log('✅ Successfully fixed priority pill contrast in App.css');
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
