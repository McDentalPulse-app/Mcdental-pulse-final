const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');

const css = `

/* ==========================================================================
   ✨ STAT CARD EXPANDING INFO (Appended by AI)
   ========================================================================== */

.admin-stat-description {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
  font-size: 13px !important;
  color: var(--text-muted, #64748b) !important;
  margin-top: 0 !important;
  text-align: center !important;
  line-height: 1.4 !important;
  border-top: 1px solid transparent !important;
}

.admin-stat-card:hover .admin-stat-description {
  max-height: 100px;
  opacity: 1;
  margin-top: 12px !important;
  padding-top: 12px !important;
  border-top-color: var(--border-color, #e2e8f0) !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  if (!appCss.includes('STAT CARD EXPANDING INFO')) {
    fs.appendFileSync(appCssPath, css);
    console.log('✅ Successfully appended expanding description animations to App.css');
  } else {
    console.log('⚠️ Expanding animations already exist in App.css');
  }
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
