const fs = require('fs');
const path = require('path');

const appCssPath = path.join(__dirname, '../src/App.css');
const indexCssPath = path.join(__dirname, '../src/index.css');

const modernStyles = `

/* ==========================================================================
   🚀 MODERN UI HARMONY OVERRIDES (Appended by AI)
   ========================================================================== */

/* 1. Global Micro-animations & Transitions */
a, button, .mc-btn-primary, .mc-btn-secondary, .mc-btn-outline, .auth-btn, .btn-gateway, .card, .mc-card {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 2. Standardized Button Styles */
button, .btn, .mc-btn-primary, .mc-btn-secondary, .mc-btn-outline, .auth-btn, .btn-gateway {
  position: relative;
  overflow: hidden;
  border-radius: 12px !important;
  font-weight: 600 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transform: translateY(0);
}

/* Primary Button Override */
.mc-btn-primary, .auth-btn, .btn-gateway {
  background: linear-gradient(135deg, var(--mc-verde-medio, #0ea5e9), var(--mc-verde-oscuro, #0284c7)) !important;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25) !important;
  border: none !important;
}

.mc-btn-primary:hover, .auth-btn:hover, .btn-gateway:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.35) !important;
  filter: brightness(1.1) !important;
}

.mc-btn-primary:active, .auth-btn:active, .btn-gateway:active {
  transform: translateY(0) scale(0.97) !important;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.2) !important;
}

/* Secondary / Outline Button Override */
.mc-btn-secondary, .mc-btn-outline {
  background: transparent !important;
  color: var(--text-main, #334155) !important;
  border: 1px solid var(--border-color, #cbd5e1) !important;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02) !important;
}

.mc-btn-secondary:hover, .mc-btn-outline:hover {
  background: var(--bg-hover, #f1f5f9) !important;
  border-color: var(--text-muted, #94a3b8) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 8px rgba(0,0,0,0.05) !important;
}

.mc-btn-secondary:active, .mc-btn-outline:active {
  transform: translateY(0) scale(0.97) !important;
}

/* Ripple effect for buttons */
button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  background: rgba(255, 255, 255, 0.4);
  opacity: 0;
  border-radius: 100%;
  transform: scale(1, 1) translate(-50%);
  transform-origin: 50% 50%;
}

@keyframes ripple {
  0% {
    transform: scale(0, 0);
    opacity: 0.5;
  }
  100% {
    transform: scale(40, 40);
    opacity: 0;
  }
}

button:focus:not(:active)::after {
  animation: ripple 0.8s ease-out;
}

/* 3. Card Elevating Hover Effects */
.mc-card, .card, .stat-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.mc-card:hover, .card:hover, .stat-card:hover {
  transform: translateY(-4px) !important;
  box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.1) !important;
}
`;

try {
  let appCss = fs.readFileSync(appCssPath, 'utf8');
  if (!appCss.includes('MODERN UI HARMONY OVERRIDES')) {
    fs.appendFileSync(appCssPath, modernStyles);
    console.log('✅ Successfully appended modern UI styles to App.css');
  } else {
    console.log('⚠️ Modern UI styles already exist in App.css');
  }
} catch (e) {
  console.error('Error updating App.css:', e.message);
}
