const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');

const css = `

/* ==========================================================================
   ✨ PULSE CHIP HOVER MORE INFO (Appended by AI)
   ========================================================================== */

.ai-engine-pulse-chip-more {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  font-size: 11px !important;
  color: var(--mc-aqua, #0ea5e9) !important;
  margin-top: 0 !important;
  white-space: nowrap;
  font-weight: 600 !important;
}

.ai-engine-pulse-chip:hover .ai-engine-pulse-chip-more {
  max-height: 20px;
  opacity: 1;
  margin-top: 6px !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  if (!appCss.includes('PULSE CHIP HOVER MORE INFO')) {
    fs.appendFileSync(appCssPath, css);
    console.log('✅ Successfully appended Pulse Chip more info animations to App.css');
  } else {
    console.log('⚠️ Pulse Chip more info animations already exist in App.css');
  }
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
