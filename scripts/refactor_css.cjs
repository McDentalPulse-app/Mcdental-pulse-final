const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');
let appCss = fs.readFileSync(appCssPath, 'utf8');

// FASE 6: Sidebar
// Reemplazar desde /* ── Sidebar ── */ hasta el bloque de @media (max-width: 768px)
appCss = appCss.replace(/\/\* ── Sidebar ── \*\/[\s\S]*?(?=@media \(max-width: 768px\)\s*\{\s*\.sidebar\s*\{)/, `/* ── Sidebar ── */
.sidebar {
  width: 240px;
  height: 100vh;
  max-height: 100vh;
  background: var(--sidebar-bg);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid var(--sidebar-border);
  box-shadow: var(--shadow-glass);
  overflow: hidden;
  z-index: 10;
  transition: var(--transition-smooth);
}

.sidebar-brand {
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.sidebar-brand-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-brand-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-brand-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.2px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-main);
}

.sidebar-brand-sub {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.2;
}

.sidebar-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
  flex-shrink: 0;
  display: block;
}

.sidebar-ai-badge {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--mc-radio-pill);
  background: var(--mc-verde-claro);
  color: var(--mc-verde);
  font-size: 9px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  font-weight: 700;
  border: 1px solid var(--sidebar-active-border);
}

.sidebar-nav {
  padding: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-nav::-webkit-scrollbar { display: none; }

.sidebar-nav-btn {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  text-align: left;
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  font-family: inherit;
  transition: var(--transition-fast);
}

.sidebar-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.sidebar-nav-btn--active {
  background: var(--sidebar-active-bg);
  border-color: var(--sidebar-active-border);
  color: var(--mc-verde);
  font-weight: 600;
}

.sidebar-nav-btn--active .sidebar-nav-icon {
  background: var(--sidebar-active-icon);
  color: var(--mc-verde);
}

.sidebar-nav-btn--active .sidebar-nav-badge {
  background: var(--mc-verde-claro);
  color: var(--mc-verde);
}

.sidebar-nav-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  flex-shrink: 0;
  color: inherit;
  transition: var(--transition-fast);
}

.sidebar-nav-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav-badge {
  background: var(--bg-subtle);
  color: var(--mc-aqua);
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--mc-radio-pill);
  flex-shrink: 0;
  letter-spacing: 0.5px;
  border: 1px solid var(--border-color);
}

.sidebar-footer {
  padding: 12px 8px 16px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--bg-subtle);
  margin-bottom: 4px;
}

.sidebar-user-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-role {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: capitalize;
  margin-top: 1px;
}

.sidebar-theme-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: var(--transition-fast);
  font-family: inherit;
}

.sidebar-theme-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.sidebar-logout {
  width: 100%;
  padding: 9px 10px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: var(--transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sidebar-logout:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

`);

// FASE 7: CARDS Y BOTONES
appCss = appCss.replace(/\.mc-card\s*\{[\s\S]*?\}\s*\.mc-card:hover\s*\{[\s\S]*?\}\s*(?:\.mc-card--interactive\s*\{[\s\S]*?\})?\s*\.mc-card--interactive:hover\s*\{[\s\S]*?\}/, `.mc-card {
  background: var(--bg-card);
  border-radius: var(--mc-radio);
  padding: 20px 22px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-card);
  transition: var(--transition-smooth);
  margin-bottom: 16px;
  max-width: 100%;
  min-width: 0;
}

.mc-card:hover {
  box-shadow: var(--shadow-sm);
}

.mc-card--interactive {
  cursor: pointer;
}

.mc-card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
}`);

appCss = appCss.replace(/\.mc-card:last-child\s*\{[\s\S]*?\}/, `.mc-card:last-child {
  margin-bottom: 0;
}`);

appCss = appCss.replace(/\.mc-btn-primary\s*\{[\s\S]*?\}\s*\.mc-btn-primary:hover:not\(:disabled\)\s*\{[\s\S]*?\}\s*(?:\.mc-btn-primary:active:not\(:disabled\)\s*\{[\s\S]*?\}\s*)?\.mc-btn-primary:disabled\s*\{[\s\S]*?\}/, `.mc-btn-primary {
  background: var(--mc-verde);
  color: #ffffff;
  border: none;
  padding: 10px 18px;
  border-radius: var(--mc-radio);
  cursor: pointer;
  font-weight: 600;
  font-family: inherit;
  font-size: 14px;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: var(--transition-fast);
  letter-spacing: -0.1px;
}

.mc-btn-primary:hover:not(:disabled) {
  background: var(--mc-verde-oscuro);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
}

.mc-btn-primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}

.mc-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}`);

appCss = appCss.replace(/\.mc-btn-secondary\s*\{[\s\S]*?\}\s*\.mc-btn-secondary:hover\s*\{[\s\S]*?\}/, `.mc-btn-secondary {
  background: var(--bg-subtle);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  padding: 10px 18px;
  border-radius: var(--mc-radio);
  cursor: pointer;
  font-weight: 600;
  font-family: inherit;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: var(--transition-fast);
}

.mc-btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}`);

appCss = appCss.replace(/\.mc-btn-outline\s*\{[\s\S]*?\}\s*\.mc-btn-outline:hover:not\(\.mc-btn-outline--edit\):not\(\.mc-btn-outline--amber\):not\(\.mc-btn-outline--danger\)\s*\{[\s\S]*?\}/, `.mc-btn-outline {
  background: transparent;
  color: var(--mc-verde);
  border: 1px solid var(--border-color);
  padding: 10px 18px;
  border-radius: var(--mc-radio);
  cursor: pointer;
  font-weight: 600;
  font-family: inherit;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition-fast);
}

.mc-btn-outline:hover:not(.mc-btn-outline--edit):not(.mc-btn-outline--amber):not(.mc-btn-outline--danger) {
  background: var(--mc-verde-claro);
  border-color: var(--mc-verde);
}`);

appCss = appCss.replace(/\.mc-btn-danger\s*\{[\s\S]*?\}\s*\.mc-btn-danger:hover\s*\{[\s\S]*?\}/, `.mc-btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: 10px 18px;
  border-radius: var(--mc-radio);
  cursor: pointer;
  font-weight: 600;
  font-family: inherit;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition-fast);
}

.mc-btn-danger:hover {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.4);
}`);

appCss = appCss.replace(/\.mc-form-input,\s*\.mc-form-select,\s*\.mc-form-textarea\s*\{[\s\S]*?\}\s*\.mc-form-input::placeholder,\s*\.mc-form-textarea::placeholder\s*\{[\s\S]*?\}\s*\.mc-form-select\s*\{[\s\S]*?\}\s*\.mc-form-textarea\s*\{[\s\S]*?\}\s*\.mc-form-input:focus,\s*\.mc-form-select:focus,\s*\.mc-form-textarea:focus\s*\{[\s\S]*?\}/, `.mc-form-input,
.mc-form-select,
.mc-form-textarea {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--mc-radio);
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-main);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: var(--transition-fast);
}

.mc-form-input::placeholder,
.mc-form-textarea::placeholder {
  color: var(--text-light);
}

.mc-form-select { font-weight: 500; cursor: pointer; }
.mc-form-textarea { resize: vertical; min-height: 96px; }

.mc-form-input:focus,
.mc-form-select:focus,
.mc-form-textarea:focus {
  border-color: var(--mc-aqua);
  background: var(--bg-card);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}`);

appCss = appCss.replace(/\.list-filter-input,\s*\.list-filter-select\s*\{([\s\S]*?)\}/, (match, p1) => {
  return match.replace(/background:\s*[^;]+;/, 'background: var(--bg-input);').replace(/border:\s*[^;]+;/, 'border: 1px solid var(--border-color);');
});
appCss = appCss.replace(/\.list-filter-input:focus,\s*\.list-filter-select:focus\s*\{([\s\S]*?)\}/, `.list-filter-input:focus,
.list-filter-select:focus {
  border-color: var(--mc-aqua);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
  outline: none;
}`);

appCss = appCss.replace(/\.table-search\s*\{([\s\S]*?)\}/, (match, p1) => {
  return match.replace(/background:\s*[^;]+;/, 'background: var(--bg-input);').replace(/border:\s*[^;]+;/, 'border: 1px solid var(--border-color);');
});
appCss = appCss.replace(/\.table-search:focus\s*\{([\s\S]*?)\}/, `.table-search:focus {
  border-color: var(--mc-aqua);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
  outline: none;
}`);

appCss = appCss.replace(/\.mensajes-composer-input\s*\{([\s\S]*?)\}/, (match, p1) => {
  return match.replace(/background:\s*[^;]+;/, 'background: var(--bg-input);').replace(/border:\s*[^;]+;/, 'border: 1px solid var(--border-color);');
});
appCss = appCss.replace(/\.mensajes-composer-input:focus\s*\{([\s\S]*?)\}/, `.mensajes-composer-input:focus {
  border-color: var(--mc-aqua);
  background: var(--bg-card);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
  outline: none;
}`);

// FASE 8: APP SHELL Y FONDO
appCss = appCss.replace(/\.app-main\s*\{[\s\S]*?\}\s*\.app-main-inner\s*\{[\s\S]*?\}/, `.app-main {
  flex: 1;
  padding: 28px 32px;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  height: 100vh;
  -webkit-overflow-scrolling: touch;
  background-color: var(--bg-body);
  transition: background-color 0.3s ease;
}

.app-main-inner {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  overflow-x: hidden;
}`);

appCss = appCss.replace(/\.app-loader\s*\{[\s\S]*?\}\s*\.app-loader-spinner\s*\{[\s\S]*?\}\s*\.app-loader-text\s*\{[\s\S]*?\}/, `.app-loader {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--bg-body);
  gap: 16px;
}

.app-loader-spinner {
  width: 36px;
  height: 36px;
  border: 2.5px solid var(--border-color);
  border-top-color: var(--mc-verde);
  border-radius: 50%;
  animation: mc-spin 0.7s linear infinite;
}

.app-loader-text {
  color: var(--text-muted);
  font-weight: 500;
  font-size: 13px;
}`);

// FASE 9: TABLA Y MODAL
appCss = appCss.replace(/\.mc-table\s*\{[\s\S]*?\}\s*\.mc-table\s*thead\s*th\s*\{[\s\S]*?\}\s*\.mc-table\s*tbody\s*td\s*\{[\s\S]*?\}\s*\.mc-table\s*tbody\s*tr:last-child\s*td\s*\{[\s\S]*?\}\s*\.mc-table\s*tbody\s*tr:hover\s*\{[\s\S]*?\}/, `.mc-table {
  width: 100%;
  text-align: left;
  border-collapse: collapse;
  min-width: 640px;
}

.mc-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 11px 14px;
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.mc-table tbody td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-light);
  font-size: 13px;
  vertical-align: middle;
  color: var(--text-main);
}

.mc-table tbody tr:last-child td {
  border-bottom: none;
}

.mc-table tbody tr:hover {
  background: var(--bg-hover);
}`);

appCss = appCss.replace(/\.mc-modal-overlay\s*\{[\s\S]*?\}\s*\.mc-modal\s*\{[\s\S]*?\}\s*\.mc-modal-title\s*\{[\s\S]*?\}/, `.mc-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mc-modal {
  background: var(--bg-card);
  padding: 28px 28px 24px;
  border-radius: var(--mc-radio-lg);
  width: min(520px, 100%);
  max-width: 100%;
  max-height: min(90vh, calc(100dvh - 40px));
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  margin: auto;
}

.mc-modal-title {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.3px;
}`);

fs.writeFileSync(appCssPath, appCss);
console.log('Fases 6 a 9 aplicadas a App.css');

// FASE 10: LandingPage.css
const landingCssPath = path.join(__dirname, '../src/components/landing/LandingPage.css');
if (fs.existsSync(landingCssPath)) {
  let landingCss = fs.readFileSync(landingCssPath, 'utf8');
  
  if (!landingCss.includes('--gw-bg: #f0f4f8;')) {
    const rootInsertPoint = landingCss.indexOf('}') + 1;
    const additional = `
/* Conectar gateway al sistema de temas */
@media (prefers-color-scheme: light) {
  :root {
    --gw-bg: #f0f4f8;
    --gw-grid: rgba(0, 0, 0, 0.04);
    --gw-glass: rgba(255, 255, 255, 0.7);
    --gw-glass-border: rgba(0, 0, 0, 0.08);
    --gw-text: #0f172a;
  }
}
`;
    landingCss = landingCss.substring(0, rootInsertPoint) + additional + landingCss.substring(rootInsertPoint);
  }

  landingCss = landingCss.replace(/\.gateway-wrapper\s*\{([\s\S]*?)\}/, (match, p1) => {
    if (!p1.includes('color: var(--gw-text')) {
      return `.gateway-wrapper {${p1}\  color: var(--gw-text, #f1f5f9);\n}`;
    }
    return match;
  });

  landingCss = landingCss.replace(/\.massive-text\s*\{([\s\S]*?)\}/, (match, p1) => {
    let replaced = p1.replace(/color:\s*[^;]+;/, 'color: var(--gw-text, #f1f5f9);');
    return `.massive-text {${replaced}}`;
  });

  fs.writeFileSync(landingCssPath, landingCss);
  console.log('Fase 10 aplicada a LandingPage.css');
}
