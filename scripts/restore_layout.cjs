const fs = require('fs');

const css = `
/* ── Layout & Sidebar (Restored & Enhanced) ── */
.app-shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background-color: var(--bg-body);
}

.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100vh;
  height: 100dvh;
  background-color: var(--bg-body);
  position: relative;
}

.app-main-inner {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px;
}

/* Sidebar */
.sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  z-index: 50;
  transition: var(--transition-smooth);
}

.sidebar-brand {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-bottom: 1px solid var(--border-light);
}

.sidebar-brand-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sidebar-logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  box-shadow: var(--shadow-sm);
}

.sidebar-brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-brand-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
}

.sidebar-brand-sub {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.sidebar-ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, rgba(13, 148, 136, 0.1), rgba(14, 165, 233, 0.1));
  border: 1px solid rgba(13, 148, 136, 0.2);
  border-radius: var(--mc-radio-pill);
  font-size: 12px;
  font-weight: 600;
  color: var(--mc-verde-oscuro);
  width: fit-content;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: var(--mc-radio);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
  width: 100%;
}

.sidebar-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.sidebar-nav-btn--active {
  background: var(--sidebar-active-bg);
  border-color: var(--sidebar-active-border);
  color: var(--mc-verde-oscuro);
}

.sidebar-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  opacity: 0.8;
}

.sidebar-nav-btn--active .sidebar-nav-icon {
  opacity: 1;
  color: var(--mc-verde-oscuro);
}

.sidebar-nav-badge {
  margin-left: auto;
  padding: 2px 8px;
  background: var(--mc-aqua);
  color: white;
  font-size: 10px;
  font-weight: 800;
  border-radius: var(--mc-radio-pill);
  letter-spacing: 0.5px;
}

.sidebar-footer {
  padding: 24px 20px;
  border-top: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px dashed var(--border-light);
}

.sidebar-user-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.sidebar-user-role {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: capitalize;
  font-weight: 500;
}

.sidebar-theme-toggle,
.sidebar-logout {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--mc-radio);
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--transition-fast);
}

.sidebar-theme-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.sidebar-logout:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

@media (max-width: 768px) {
  .app-shell {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--sidebar-border);
  }
  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 12px;
    gap: 12px;
  }
  .sidebar-nav-btn {
    width: auto;
    white-space: nowrap;
  }
  .sidebar-footer {
    display: none;
  }
  .app-main-inner {
    padding: 16px;
  }
}
`;

fs.appendFileSync('src/index.css', css);
console.log("Appended missing styles to index.css");
