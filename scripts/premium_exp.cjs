const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');

const premiumCss = `

/* ==========================================================================
   ✨ ULTRA PREMIUM EXPEDIENTES IA OVERRIDES (Appended by AI)
   ========================================================================== */

.ai-expedientes-premium-container {
  display: flex !important;
  flex-direction: column !important;
  gap: 24px !important;
}

.ai-premium-grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(600px, 1fr)) !important;
  gap: 32px !important;
  margin-top: 16px !important;
}

@media (max-width: 768px) {
  .ai-premium-grid {
    grid-template-columns: 1fr !important;
  }
}

.ai-premium-card {
  background: var(--bg-card, #ffffff) !important;
  border-radius: 24px !important;
  box-shadow: 0 12px 32px rgba(0,0,0,0.04) !important;
  border: 1px solid rgba(226, 232, 240, 0.8) !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  position: relative !important;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
}

.ai-premium-card:hover {
  transform: translateY(-4px) !important;
  box-shadow: 0 20px 48px rgba(0,0,0,0.08) !important;
  border-color: rgba(226, 232, 240, 1) !important;
}

.ai-premium-card-banner {
  height: 80px !important;
  width: 100% !important;
  position: relative !important;
}

.ai-premium-pill-absolute {
  position: absolute !important;
  top: 16px !important;
  right: 16px !important;
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(8px) !important;
  padding: 6px 12px !important;
  border-radius: 20px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  color: var(--text-main, #0f172a) !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
}

.ai-premium-card-header {
  display: flex !important;
  align-items: flex-end !important;
  padding: 0 32px !important;
  margin-top: -36px !important;
  gap: 20px !important;
  position: relative !important;
  z-index: 2 !important;
}

.ai-premium-avatar-wrapper {
  background: var(--bg-card, #fff) !important;
  padding: 4px !important;
  border-radius: 50% !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.06) !important;
}

.ai-premium-info h3 {
  margin: 0 0 4px 0 !important;
  font-size: 22px !important;
  font-weight: 800 !important;
  color: var(--text-main, #0f172a) !important;
  letter-spacing: -0.5px !important;
}

.ai-premium-info p {
  margin: 0 !important;
  font-size: 14px !important;
  color: var(--text-muted, #64748b) !important;
  font-weight: 500 !important;
}

.ai-premium-card-body {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 32px !important;
  padding: 32px !important;
  flex: 1 !important;
}

@media (max-width: 640px) {
  .ai-premium-card-body {
    grid-template-columns: 1fr !important;
  }
}

.ai-premium-col {
  display: flex !important;
  flex-direction: column !important;
  gap: 24px !important;
}

.ai-premium-stats {
  display: flex !important;
  gap: 16px !important;
}

.ai-premium-stat {
  flex: 1 !important;
  background: var(--bg-subtle, #f8fafc) !important;
  border: 1px solid var(--border-color, #f1f5f9) !important;
  border-radius: 16px !important;
  padding: 16px !important;
  display: flex !important;
  flex-direction: column !important;
}

.ai-premium-stat span {
  font-size: 12px !important;
  text-transform: uppercase !important;
  font-weight: 700 !important;
  color: var(--text-muted, #94a3b8) !important;
  letter-spacing: 0.5px !important;
  margin-bottom: 8px !important;
}

.ai-premium-stat strong {
  font-size: 28px !important;
  font-weight: 800 !important;
  line-height: 1 !important;
  margin-bottom: 4px !important;
}

.ai-premium-stat small {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: var(--text-muted, #64748b) !important;
}

.ai-premium-risks h4, .ai-premium-summary h4 {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  margin: 0 0 12px 0 !important;
  font-size: 14px !important;
  color: var(--text-main, #334155) !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}

.ai-premium-risks ul {
  list-style: none !important;
  padding: 0 !important;
  margin: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
}

.ai-premium-risks li {
  background: rgba(239, 68, 68, 0.05) !important;
  border-left: 3px solid #ef4444 !important;
  padding: 10px 12px !important;
  border-radius: 0 8px 8px 0 !important;
  font-size: 13px !important;
  color: #7f1d1d !important;
  line-height: 1.4 !important;
}

.ai-premium-empty {
  font-size: 13px !important;
  color: var(--text-muted, #94a3b8) !important;
  font-style: italic !important;
}

.ai-premium-summary p {
  margin: 0 0 16px 0 !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  color: var(--text-muted, #475569) !important;
}

.ai-premium-rec {
  background: rgba(16, 185, 129, 0.1) !important;
  color: #059669 !important;
  padding: 12px 16px !important;
  border-radius: 12px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.ai-premium-gemini-panel {
  background: var(--bg-subtle, #f8fafc) !important;
  border-top: 1px solid var(--border-color, #e2e8f0) !important;
  padding: 24px 32px !important;
}

.ai-premium-gemini-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  flex-wrap: wrap !important;
  gap: 16px !important;
}

.ai-premium-gemini-header span {
  font-size: 15px !important;
  font-weight: 700 !important;
  color: var(--mc-aqua, #0ea5e9) !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.btn-ai-premium-glow {
  background: linear-gradient(135deg, #8b5cf6, #4f46e5) !important;
  color: white !important;
  border: none !important;
  padding: 10px 20px !important;
  border-radius: 12px !important;
  font-weight: 700 !important;
  font-size: 14px !important;
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3) !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
}

.btn-ai-premium-glow:hover:not(:disabled) {
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.5) !important;
  transform: translateY(-2px) !important;
  background: linear-gradient(135deg, #7c3aed, #4338ca) !important;
}

.btn-ai-premium-glow:disabled {
  opacity: 0.7 !important;
  cursor: not-allowed !important;
}

.ai-premium-gemini-content {
  margin-top: 20px !important;
  background: #ffffff !important;
  border: 1px solid rgba(139, 92, 246, 0.2) !important;
  border-radius: 16px !important;
  padding: 24px !important;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.05) !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  if (!appCss.includes('ULTRA PREMIUM EXPEDIENTES IA OVERRIDES')) {
    fs.appendFileSync(appCssPath, premiumCss);
    console.log('✅ Successfully appended Ultra Premium Expedientes IA styles to App.css');
  } else {
    console.log('⚠️ Ultra Premium styles already exist in App.css');
  }
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
