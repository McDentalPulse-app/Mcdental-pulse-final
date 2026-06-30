const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '../src');

// Helper to recursively get files
function getFiles(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, ext));
    } else if (filePath.endsWith(ext)) {
      results.push(filePath);
    }
  }
  return results;
}

// ==========================================
// FASE 1: SISTEMA DE COLOR LIMPIO
// ==========================================

// 1. Update index.css
const indexCssPath = path.join(root, 'index.css');
if (fs.existsSync(indexCssPath)) {
  let indexCss = fs.readFileSync(indexCssPath, 'utf8');

  // Add to dark theme
  const darkVars = `
  --mc-verde-medio: var(--mc-verde);
  --mc-gris-perla: var(--bg-card);
  --mc-texto: var(--text-main);
  --mc-gris-suave: var(--border-color);
  --mc-blanco: var(--bg-card);
  --mc-gris-texto: var(--text-muted);
  --mc-verde-oscuro: #0d9488;
  --mc-sombra: var(--shadow-lg);
  --mc-sombra-suave: var(--shadow-sm);
`;
  if (!indexCss.includes('--mc-verde-medio: var(--mc-verde);') && indexCss.includes('[data-theme="dark"] {')) {
    indexCss = indexCss.replace(/(\[data-theme="dark"\]\s*\{[^}]*?)(\n\s*\})/, `$1${darkVars}$2`);
  }

  // Add to light theme
  const lightVars = `
  --mc-verde-medio: var(--mc-verde);
  --mc-gris-texto: var(--text-muted);
  --mc-sombra: var(--shadow-lg);
  --mc-sombra-suave: var(--shadow-sm);
`;
  if (indexCss.includes('[data-theme="light"] {')) {
    indexCss = indexCss.replace(/(\[data-theme="light"\]\s*\{[^}]*?)(\n\s*\})/, `$1${lightVars}$2`);
  }
  fs.writeFileSync(indexCssPath, indexCss);
  console.log('✅ Updated index.css variables');
}

// 2. Delete theme.js
const themeJsPath = path.join(root, 'config/theme.js');
if (fs.existsSync(themeJsPath)) {
  fs.unlinkSync(themeJsPath);
  console.log('✅ Deleted theme.js');
}

// 3. Replace theme imports and usages in all JSX
const jsxFiles = getFiles(root, '.jsx');
const themeMap = {
  'UI.verde': "'var(--mc-verde)'",
  'UI.verdeMedio': "'var(--mc-verde-medio)'",
  'UI.verdeOscuro': "'var(--mc-verde-oscuro)'",
  'UI.verdeClaro': "'var(--mc-verde-claro)'",
  'UI.aqua': "'var(--mc-aqua)'",
  'UI.grisTexto': "'var(--text-muted)'",
  'UI.grisSuave': "'var(--border-color)'",
  'UI.texto': "'var(--text-main)'",
  'UI.blanco': "'var(--bg-card)'",
  'UI.sombra': "'var(--shadow-lg)'",
  'UI.sombraSuave': "'var(--shadow-sm)'",
  'UI.radio': "'16px'"
};

for (const file of jsxFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Remove import
  content = content.replace(/^import\s+UI\s+from\s+['"](?:\.\.\/|\.\/)*config\/theme['"];?\s*$/gm, '');
  
  // Replace usages
  for (const [key, value] of Object.entries(themeMap)) {
    // We use a regex that matches the exact word to avoid partial matches
    const regex = new RegExp(`\\b${key.replace('.', '\\.')}\\b`, 'g');
    content = content.replace(regex, value);
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`✅ Updated theme usages in ${path.basename(file)}`);
  }
}

// ==========================================
// FASE 2 & 4: PURGAR APP.CSS Y SIDEBAR
// ==========================================

const appCssPath = path.join(root, 'App.css');
if (fs.existsSync(appCssPath)) {
  let css = fs.readFileSync(appCssPath, 'utf8');

  // Blocks to remove completely
  const blocksToRemove = [
    '🚀 MODERN UI HARMONY OVERRIDES',
    '✨ AI ENGINE REDESIGN OVERRIDES',
    '✨ EXPEDIENTES IA REDESIGN OVERRIDES',
    '✨ ULTRA PREMIUM EXPEDIENTES IA OVERRIDES',
    '✨ PRIORITY PILL FIX',
    '✨ COPILOT CHAT UI OVERRIDES',
    '✨ PULSE SCORE & STAT CARDS ANIMATIONS',
    '✨ STAT CARD EXPANDING INFO',
    '✨ PULSE CHIP HOVER MORE INFO'
  ];

  for (const block of blocksToRemove) {
    const regex = new RegExp(`\\/\\* ={74}\\n\\s*${block}.*?(?=\\/\\* ={74}|$|\\/\\* ──)`, 'gs');
    css = css.replace(regex, '');
  }

  // Update .mc-card:hover
  const cardHoverRegex = /\.mc-card:hover\s*\{[^}]*\}/;
  const newCardHover = `.mc-card:hover {
  box-shadow: var(--shadow-md);
}

.mc-card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--mc-aqua);
}`;
  if (css.match(cardHoverRegex)) {
    css = css.replace(cardHoverRegex, newCardHover);
  } else {
    // If not found, just append it
    css += `\n${newCardHover}\n`;
  }

  // Form rules hardcoded hex
  css = css.replace(/background:\s*#fafbfc/g, 'background: var(--bg-subtle)');
  css = css.replace(/background:\s*#fafcfd/g, 'background: var(--bg-subtle)');
  css = css.replace(/background:\s*#f9fafb/g, 'background: var(--bg-subtle)');
  css = css.replace(/border-bottom:\s*1px solid #f1f5f9/g, 'border-bottom: 1px solid var(--border-light)');
  css = css.replace(/border-bottom:\s*1px solid #eef2f6/g, 'border-bottom: 1px solid var(--border-light)');

  // Badges and pills
  const badgeReplacements = {
    '.mc-badge--verde  { background: #dcfce7; color: #15803d; }': '.mc-badge--verde  { background: rgba(16, 185, 129, 0.15); color: var(--mc-semaforo-verde); }',
    '.mc-badge--amarillo { background: #fef3c7; color: #b45309; }': '.mc-badge--amarillo { background: rgba(245, 158, 11, 0.15); color: var(--mc-semaforo-amarillo); }',
    '.mc-badge--rojo { background: #fee2e2; color: #b91c1c; }': '.mc-badge--rojo { background: rgba(239, 68, 68, 0.15); color: var(--mc-semaforo-rojo); }',
    '.mc-badge--default { background: rgba(0, 0, 0, 0.3); color: #cbd5e1; }': '.mc-badge--default { background: var(--bg-subtle); color: var(--text-muted); }',
    '.mc-status-pill--activo { background: #dcfce7; color: #166534; }': '.mc-status-pill--activo { background: rgba(16, 185, 129, 0.15); color: var(--mc-semaforo-verde); }',
    '.mc-status-pill--inactivo { background: #fee2e2; color: #991b1b; }': '.mc-status-pill--inactivo { background: rgba(239, 68, 68, 0.15); color: var(--mc-semaforo-rojo); }',
    '.mc-status-pill--pendiente { background: #fef3c7; color: #92400e; }': '.mc-status-pill--pendiente { background: rgba(245, 158, 11, 0.15); color: var(--mc-semaforo-amarillo); }',
    '.mc-status-pill--aprobada,\n.mc-status-pill--aprobado { background: #dcfce7; color: #166534; }': '.mc-status-pill--aprobada,\n.mc-status-pill--aprobado { background: rgba(16, 185, 129, 0.15); color: var(--mc-semaforo-verde); }',
    '.mc-status-pill--rechazada,\n.mc-status-pill--rechazado { background: #fee2e2; color: #991b1b; }': '.mc-status-pill--rechazada,\n.mc-status-pill--rechazado { background: rgba(239, 68, 68, 0.15); color: var(--mc-semaforo-rojo); }'
  };
  
  for (const [oldStr, newStr] of Object.entries(badgeReplacements)) {
    // Just simple string replace, fallback to regex if spacing issues
    const safeOldStr = oldStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\\s+/g, '\\s+');
    css = css.replace(new RegExp(safeOldStr, 'g'), newStr);
  }
  // Try more flexible regex for badges if strict match fails
  css = css.replace(/\.mc-badge--verde\s*\{\s*background:\s*#dcfce7;\s*color:\s*#15803d;\s*\}/g, '.mc-badge--verde { background: rgba(16, 185, 129, 0.15); color: var(--mc-semaforo-verde); }');
  css = css.replace(/\.mc-badge--amarillo\s*\{\s*background:\s*#fef3c7;\s*color:\s*#b45309;\s*\}/g, '.mc-badge--amarillo { background: rgba(245, 158, 11, 0.15); color: var(--mc-semaforo-amarillo); }');
  css = css.replace(/\.mc-badge--rojo\s*\{\s*background:\s*#fee2e2;\s*color:\s*#b91c1c;\s*\}/g, '.mc-badge--rojo { background: rgba(239, 68, 68, 0.15); color: var(--mc-semaforo-rojo); }');
  css = css.replace(/\.mc-badge--default\s*\{\s*background:\s*rgba\(0,\s*0,\s*0,\s*0\.3\);\s*color:\s*#cbd5e1;\s*\}/g, '.mc-badge--default { background: var(--bg-subtle); color: var(--text-muted); }');
  
  css = css.replace(/\.mc-status-pill--activo\s*\{\s*background:\s*#dcfce7;\s*color:\s*#166534;\s*\}/g, '.mc-status-pill--activo { background: rgba(16, 185, 129, 0.15); color: var(--mc-semaforo-verde); }');
  css = css.replace(/\.mc-status-pill--inactivo\s*\{\s*background:\s*#fee2e2;\s*color:\s*#991b1b;\s*\}/g, '.mc-status-pill--inactivo { background: rgba(239, 68, 68, 0.15); color: var(--mc-semaforo-rojo); }');
  css = css.replace(/\.mc-status-pill--pendiente\s*\{\s*background:\s*#fef3c7;\s*color:\s*#92400e;\s*\}/g, '.mc-status-pill--pendiente { background: rgba(245, 158, 11, 0.15); color: var(--mc-semaforo-amarillo); }');
  css = css.replace(/\.mc-status-pill--aprobada,\s*\.mc-status-pill--aprobado\s*\{\s*background:\s*#dcfce7;\s*color:\s*#166534;\s*\}/g, '.mc-status-pill--aprobada,\n.mc-status-pill--aprobado { background: rgba(16, 185, 129, 0.15); color: var(--mc-semaforo-verde); }');
  css = css.replace(/\.mc-status-pill--rechazada,\s*\.mc-status-pill--rechazado\s*\{\s*background:\s*#fee2e2;\s*color:\s*#991b1b;\s*\}/g, '.mc-status-pill--rechazada,\n.mc-status-pill--rechazado { background: rgba(239, 68, 68, 0.15); color: var(--mc-semaforo-rojo); }');

  // Sidebar CSS updates
  const newSidebarActive = `.sidebar-nav-btn--active {
  background: rgba(20, 184, 166, 0.12);
  border-color: rgba(20, 184, 166, 0.3);
  color: var(--text-main);
  font-weight: 600;
}

.sidebar-nav-btn--active .sidebar-nav-icon {
  background: rgba(20, 184, 166, 0.2);
  color: var(--mc-verde);
}`;
  css = css.replace(/\.sidebar-nav-btn--active\s*\{[^}]*\}/, newSidebarActive);
  css = css.replace(/\.sidebar-nav-btn--active\s*\.sidebar-nav-icon\s*\{[^}]*\}/, '');

  // Handle @media duplicate cleanup (basic regex approach, might need manual touch-up later if this misses)
  const mediaSidebarRegex = /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\}/;
  const match = css.match(mediaSidebarRegex);
  if (match) {
    let mediaContent = match[1];
    mediaContent = mediaContent.replace(/\.sidebar-nav-btn--active\s*\{[^}]*\}/g, '');
    mediaContent = mediaContent.replace(/\.sidebar-nav-btn--active\s*\.sidebar-nav-icon\s*\{[^}]*\}/g, '');
    
    mediaContent += `
  .sidebar-nav-btn--active {
    background: rgba(20, 184, 166, 0.15);
    border-color: rgba(20, 184, 166, 0.5);
    box-shadow: inset 0 -2px 0 var(--mc-verde);
  }
  .sidebar-nav-btn--active .sidebar-nav-icon {
    background: rgba(20, 184, 166, 0.25);
    color: var(--mc-verde);
    box-shadow: none;
  }`;
    css = css.replace(mediaSidebarRegex, `@media (max-width: 768px) {${mediaContent}}`);
  }

  // Final cleanup of extra stray blocks inside @media for active
  css = css.replace(/\.sidebar-nav-btn--active\s*\{[^}]*\}\s*\.sidebar-nav-btn--active\s*\.sidebar-nav-icon\s*\{[^}]*\}/g, '');

  fs.writeFileSync(appCssPath, css);
  console.log('✅ Purged App.css overridess and updated sidebar CSS');
}

console.log('✅ Script completed.');
