const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');

const chatCss = `

/* ==========================================================================
   ✨ COPILOT CHAT UI OVERRIDES (Appended by AI)
   ========================================================================== */

.ai-copiloto-chat-container {
  display: flex !important;
  flex-direction: column !important;
  height: 600px !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  border-radius: 20px !important;
  overflow: hidden !important;
  background: var(--bg-card, #ffffff) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.04) !important;
}

.ai-copiloto-messages {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 24px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 20px !important;
  background: var(--bg-subtle, #f8fafc) !important;
}

.ai-copiloto-welcome {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  height: 100% !important;
  color: var(--text-muted, #64748b) !important;
  padding: 24px !important;
}

.ai-copiloto-welcome-icon {
  background: linear-gradient(135deg, #0ea5e9, #8b5cf6) !important;
  color: white !important;
  width: 64px !important;
  height: 64px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 20px !important;
  margin-bottom: 20px !important;
  box-shadow: 0 8px 24px rgba(14, 165, 233, 0.25) !important;
}

.ai-copiloto-welcome h3 {
  color: var(--text-main, #0f172a) !important;
  margin-bottom: 8px !important;
  font-size: 20px !important;
}

.ai-copiloto-suggestions {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  margin-top: 32px !important;
  width: 100% !important;
  max-width: 400px !important;
}

.ai-copiloto-suggestions button {
  background: white !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  padding: 14px 16px !important;
  border-radius: 12px !important;
  color: var(--mc-aqua, #0ea5e9) !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  text-align: left !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02) !important;
}

.ai-copiloto-suggestions button:hover {
  background: var(--mc-aqua, #0ea5e9) !important;
  color: white !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.2) !important;
}

.ai-chat-msg {
  display: flex !important;
  gap: 16px !important;
  max-width: 85% !important;
  animation: fadeIn 0.3s ease-out forwards !important;
}

.ai-chat-msg--user {
  align-self: flex-end !important;
  flex-direction: row-reverse !important;
}

.ai-chat-msg--ai {
  align-self: flex-start !important;
}

.ai-chat-avatar {
  width: 36px !important;
  height: 36px !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
}

.ai-chat-msg--user .ai-chat-avatar {
  background: linear-gradient(135deg, #10b981, #059669) !important;
}

.ai-chat-msg--ai .ai-chat-avatar {
  background: linear-gradient(135deg, #0ea5e9, #8b5cf6) !important;
}

.ai-chat-bubble {
  background: white !important;
  padding: 16px 20px !important;
  border-radius: 20px !important;
  border: 1px solid var(--border-color, #e2e8f0) !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02) !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  color: var(--text-main, #334155) !important;
}

.ai-chat-msg--user .ai-chat-bubble {
  background: var(--text-main, #0f172a) !important;
  color: white !important;
  border-color: transparent !important;
  border-top-right-radius: 4px !important;
}

.ai-chat-msg--ai .ai-chat-bubble {
  border-top-left-radius: 4px !important;
  background: linear-gradient(to bottom right, #ffffff, #f8fafc) !important;
}

.ai-chat-loading-msg .ai-chat-bubble {
  color: var(--text-muted, #94a3b8) !important;
  font-style: italic !important;
}

.ai-copiloto-composer {
  display: flex !important;
  gap: 12px !important;
  padding: 20px !important;
  background: white !important;
  border-top: 1px solid var(--border-color, #e2e8f0) !important;
}

.ai-copiloto-composer textarea {
  flex: 1 !important;
  resize: none !important;
  border-radius: 16px !important;
  border: 1px solid var(--border-color, #cbd5e1) !important;
  padding: 14px 20px !important;
  font-size: 15px !important;
  background: var(--bg-subtle, #f8fafc) !important;
  transition: all 0.2s ease !important;
  outline: none !important;
}

.ai-copiloto-composer textarea:focus {
  background: white !important;
  border-color: var(--mc-aqua, #0ea5e9) !important;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1) !important;
}

.btn-ai-chat-send {
  background: linear-gradient(135deg, #0ea5e9, #3b82f6) !important;
  color: white !important;
  border: none !important;
  width: 52px !important;
  height: 52px !important;
  border-radius: 16px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3) !important;
  flex-shrink: 0 !important;
}

.btn-ai-chat-send:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 24px rgba(14, 165, 233, 0.4) !important;
}

.btn-ai-chat-send:disabled {
  background: #cbd5e1 !important;
  box-shadow: none !important;
  cursor: not-allowed !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  if (!appCss.includes('COPILOT CHAT UI OVERRIDES')) {
    fs.appendFileSync(appCssPath, chatCss);
    console.log('✅ Successfully appended Copilot Chat UI styles to App.css');
  } else {
    console.log('⚠️ Copilot Chat styles already exist in App.css');
  }
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
