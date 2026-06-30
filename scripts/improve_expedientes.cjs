const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');

const expedientesStyles = `

/* ==========================================================================
   ✨ EXPEDIENTES IA REDESIGN OVERRIDES (Appended by AI)
   ========================================================================== */

.ai-expedientes-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 24px !important;
  margin-top: 16px !important;
}

.ai-exp-item {
  background: var(--bg-card, #ffffff) !important;
  border-radius: 20px !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  padding: 24px !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.03) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.ai-exp-item:hover {
  box-shadow: 0 12px 32px rgba(0,0,0,0.06) !important;
  transform: translateY(-2px) !important;
}

.ai-exp-stats {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
  gap: 16px !important;
  margin: 24px 0 !important;
}

.ai-exp-stat-card {
  background: var(--bg-subtle, #f8fafc) !important;
  border-radius: 16px !important;
  padding: 16px !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  transition: all 0.2s ease !important;
}

.ai-exp-stat-card:hover {
  background: #ffffff !important;
  border-color: var(--mc-aqua, #0ea5e9) !important;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.08) !important;
}

.ai-exp-stat-label {
  font-size: 13px !important;
  color: var(--text-muted, #64748b) !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  margin-bottom: 8px !important;
}

.ai-exp-stat-val {
  font-size: 28px !important;
  font-weight: 800 !important;
  line-height: 1.1 !important;
  margin-bottom: 4px !important;
  letter-spacing: -0.5px !important;
}

.ai-exp-stat-val--count {
  color: var(--text-main, #0f172a) !important;
}

.ai-exp-stat-sub {
  font-size: 13px !important;
  color: var(--text-muted, #64748b) !important;
}

.ai-exp-box {
  background: var(--bg-subtle, #f8fafc) !important;
  border-radius: 12px !important;
  padding: 16px !important;
  margin-bottom: 16px !important;
  border-left: 4px solid var(--text-muted, #cbd5e1) !important;
}

.ai-exp-box-header {
  font-weight: 700 !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  margin-bottom: 8px !important;
  color: var(--text-main, #0f172a) !important;
}

.ai-exp-box-content {
  font-size: 14px !important;
  color: var(--text-muted, #475569) !important;
  line-height: 1.6 !important;
}

.ai-exp-risk-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
}

.ai-exp-risk-item {
  font-size: 14px !important;
  color: var(--text-main, #334155) !important;
}

.ai-exp-recommendation {
  background: rgba(16, 185, 129, 0.1) !important;
  color: #059669 !important;
  padding: 16px !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  margin-top: 24px !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.ai-exp-recommendation::before {
  content: '💡';
  font-size: 18px !important;
}

/* Gemini Analysis Box */
.ai-exp-gemini-box {
  margin-top: 24px !important;
  border-top: 1px dashed var(--border-color, #e2e8f0) !important;
  padding-top: 24px !important;
}

.ai-exp-gemini-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 16px !important;
  margin-bottom: 16px !important;
}

.ai-exp-gemini-title {
  font-size: 18px !important;
  font-weight: 700 !important;
  color: var(--mc-aqua, #0ea5e9) !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.btn-ai-gradient {
  background: linear-gradient(135deg, #a855f7, #6366f1) !important;
  color: white !important;
  border: none !important;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3) !important;
}
.btn-ai-gradient:hover {
  background: linear-gradient(135deg, #9333ea, #4f46e5) !important;
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4) !important;
}

.ai-exp-gemini-output {
  background: linear-gradient(to bottom right, rgba(168, 85, 247, 0.05), rgba(99, 102, 241, 0.05)) !important;
  border: 1px solid rgba(168, 85, 247, 0.2) !important;
  border-radius: 16px !important;
  padding: 24px !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  if (!appCss.includes('EXPEDIENTES IA REDESIGN OVERRIDES')) {
    fs.appendFileSync(appCssPath, expedientesStyles);
    console.log('✅ Successfully appended Expedientes IA redesign styles to App.css');
  } else {
    console.log('⚠️ Expedientes IA redesign styles already exist in App.css');
  }
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
