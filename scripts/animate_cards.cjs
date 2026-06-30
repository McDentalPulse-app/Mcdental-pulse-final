const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');

const css = `

/* ==========================================================================
   ✨ PULSE SCORE & STAT CARDS ANIMATIONS (Appended by AI)
   ========================================================================== */

.admin-stat-card,
.psico-priority-card,
.ai-stat-mb > div {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  cursor: pointer !important;
}

.admin-stat-card:hover,
.psico-priority-card:hover,
.ai-stat-mb > div:hover {
  transform: translateY(-4px) !important;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.08) !important;
  border-color: var(--mc-aqua, #0ea5e9) !important;
}

.admin-stat-card .admin-stat-icon-wrap {
  transition: transform 0.3s ease !important;
}

.admin-stat-card:hover .admin-stat-icon-wrap {
  transform: scale(1.1) rotate(5deg) !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  if (!appCss.includes('PULSE SCORE & STAT CARDS ANIMATIONS')) {
    fs.appendFileSync(appCssPath, css);
    console.log('✅ Successfully appended Stat Card animations to App.css');
  } else {
    console.log('⚠️ Stat Card animations already exist in App.css');
  }
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
