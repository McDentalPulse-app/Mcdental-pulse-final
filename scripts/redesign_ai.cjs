const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');

const aiStyles = `

/* ==========================================================================
   ✨ AI ENGINE REDESIGN OVERRIDES (Appended by AI)
   ========================================================================== */

/* Header */
.ai-engine-header {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(2, 132, 199, 0.05) 100%) !important;
  border: 1px solid rgba(14, 165, 233, 0.2) !important;
  border-radius: 16px !important;
  padding: 24px !important;
  backdrop-filter: blur(12px) !important;
  box-shadow: 0 8px 32px rgba(14, 165, 233, 0.05) !important;
  margin-bottom: 24px !important;
  display: flex !important;
  align-items: center !important;
  gap: 20px !important;
}

.ai-engine-header-icon {
  background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3) !important;
  border-radius: 12px !important;
  width: 48px !important;
  height: 48px !important;
}

/* Tabs as a modern Segment Control */
.ai-engine-tabs {
  background: var(--bg-subtle, #f1f5f9) !important;
  padding: 6px !important;
  border-radius: 14px !important;
  display: flex !important;
  gap: 8px !important;
  margin-bottom: 24px !important;
  overflow-x: auto !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  scrollbar-width: none;
}
.ai-engine-tabs::-webkit-scrollbar {
  display: none;
}

.ai-engine-tab {
  border-radius: 10px !important;
  padding: 10px 16px !important;
  font-weight: 600 !important;
  color: var(--text-muted, #64748b) !important;
  background: transparent !important;
  border: none !important;
  transition: all 0.25s ease !important;
  white-space: nowrap !important;
}

.ai-engine-tab:hover {
  color: var(--text-main, #0f172a) !important;
  background: rgba(255, 255, 255, 0.5) !important;
}

.ai-engine-tab--active {
  background: #ffffff !important;
  color: var(--mc-aqua, #0ea5e9) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
}

/* Pulse Chips (Horizontal Scroll) */
.ai-engine-pulse-chips {
  display: flex !important;
  gap: 12px !important;
  overflow-x: auto !important;
  padding-bottom: 12px !important;
  margin-bottom: 24px !important;
  scrollbar-width: thin;
}

.ai-engine-pulse-chip {
  background: var(--bg-card, #fff) !important;
  border-radius: 12px !important;
  padding: 8px 12px !important;
  min-width: 160px !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03) !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  transition: all 0.25s ease !important;
}

.ai-engine-pulse-chip:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,0.08) !important;
  border-color: var(--mc-aqua, #0ea5e9) !important;
}

/* AI Alert & Resumen Items */
.ai-resumen-item, .ai-alerta-item, .ai-copiloto-item, .ai-prediccion-card {
  background: var(--bg-card, #fff) !important;
  border-radius: 16px !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  padding: 20px !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02) !important;
  transition: all 0.25s ease !important;
  margin-bottom: 16px !important;
}

.ai-resumen-item:hover, .ai-alerta-item:hover, .ai-copiloto-item:hover, .ai-prediccion-card:hover {
  transform: translateY(-4px) !important;
  box-shadow: 0 12px 24px rgba(0,0,0,0.06) !important;
  border-color: var(--text-muted, #94a3b8) !important;
}

/* Colored borders based on priority */
.ai-resumen-item--crítica, .ai-resumen-item--critica { border-left: 4px solid var(--mc-semaforo-rojo, #ef4444) !important; }
.ai-resumen-item--alta { border-left: 4px solid var(--mc-semaforo-rojo, #ef4444) !important; }
.ai-resumen-item--media { border-left: 4px solid var(--mc-semaforo-amarillo, #f59e0b) !important; }

/* Generated AI Blocks */
.ai-section {
  border-radius: 16px !important;
  border: 1px solid rgba(14, 165, 233, 0.2) !important;
  background: linear-gradient(to bottom right, rgba(14, 165, 233, 0.03), rgba(2, 132, 199, 0.08)) !important;
  padding: 24px !important;
  margin-bottom: 24px !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5) !important;
}

.ai-section-header {
  font-weight: 700 !important;
  color: var(--mc-aqua, #0ea5e9) !important;
  font-size: 16px !important;
  margin-bottom: 16px !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

/* AI Copilot Input */
.mensajes-composer textarea {
  border-radius: 12px !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  padding: 16px !important;
  font-size: 15px !important;
  background: var(--bg-subtle, #f8fafc) !important;
  transition: all 0.25s ease !important;
}
.mensajes-composer textarea:focus {
  background: var(--bg-card, #fff) !important;
  border-color: var(--mc-aqua, #0ea5e9) !important;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1) !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  if (!appCss.includes('AI ENGINE REDESIGN OVERRIDES')) {
    fs.appendFileSync(appCssPath, aiStyles);
    console.log('✅ Successfully appended AI Engine redesign styles to App.css');
  } else {
    console.log('⚠️ AI Engine redesign styles already exist in App.css');
  }
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
