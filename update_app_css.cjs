const fs = require('fs');
const path = './src/App.css';

let css = fs.readFileSync(path, 'utf8');

// 1. Upgrade .mc-card to Glassmorphism
css = css.replace(
  /\.mc-card \{\s*background: var\(--bg-card\);\s*border-radius: var\(--mc-radio\);\s*padding: 22px 24px;\s*border: 1px solid var\(--border-color\);\s*box-shadow: var\(--mc-sombra-suave\);\s*transition:.*?\s*margin-bottom: 16px;\s*max-width: 100%;\s*min-width: 0;\s*\}/gs,
  `.mc-card {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: var(--mc-radio);
  padding: 22px 24px;
  border: var(--glass-border);
  box-shadow: var(--shadow-sm);
  transition: var(--transition-smooth);
  margin-bottom: 16px;
  max-width: 100%;
  min-width: 0;
}

.mc-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--mc-aqua);
}`
);

// 2. Sidebar clean up
css = css.replace(
  /\.sidebar \{\s*width: 248px;\s*height: 100vh;\s*max-height: 100vh;\s*background: var\(--bg-sidebar\);\s*color: var\(--text-inverse\);\s*display: flex;\s*flex-direction: column;\s*transition: transform 0\.3s ease;\s*flex-shrink: 0;\s*z-index: 100;\s*\}/gs,
  `.sidebar {
  width: 248px;
  height: 100vh;
  max-height: 100vh;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-light);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  flex-shrink: 0;
  z-index: 100;
}`
);

// Fix sidebar text colors
css = css.replace(
  /\.sidebar-nav-btn \{\s*width: 100%;\s*display: flex;\s*align-items: center;\s*gap: 12px;\s*padding: 12px 16px;\s*background: transparent;\s*border: none;\s*color: rgba\(255, 255, 255, 0\.6\);\s*/gs,
  `.sidebar-nav-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text-muted);
`
);

css = css.replace(
  /\.sidebar-nav-btn:hover \{\s*background: rgba\(255, 255, 255, 0\.05\);\s*color: #fff;\s*\}/gs,
  `.sidebar-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}`
);

css = css.replace(
  /\.sidebar-nav-btn--active \{\s*background: rgba\(255, 255, 255, 0\.1\);\s*color: #fff;\s*border-right: 3px solid var\(--mc-aqua\);\s*\}/gs,
  `.sidebar-nav-btn--active {
  background: var(--bg-subtle);
  color: var(--mc-aqua);
  border-right: 3px solid var(--mc-aqua);
  font-weight: 600;
}`
);

// 3. Improve Buttons
css = css.replace(
  /\.mc-btn \{\s*display: inline-flex;\s*align-items: center;\s*justify-content: center;\s*gap: 8px;\s*padding: 12px 24px;\s*border-radius: 999px;\s*font-weight: 600;\s*font-size: 14px;\s*cursor: pointer;\s*transition: all 0\.2s ease;\s*border: none;\s*\}/gs,
  `.mc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: var(--transition-smooth);
  border: none;
}`
);

// 4. Improve Inputs
css = css.replace(
  /\.mc-input, \.mc-select, \.mc-textarea \{\s*width: 100%;\s*padding: 12px 16px;\s*border-radius: 12px;\s*border: 1px solid var\(--mc-gris-suave\);\s*background: var\(--mc-blanco\);\s*color: var\(--mc-texto\);\s*font-family: inherit;\s*font-size: 15px;\s*transition: all 0\.2s ease;\s*outline: none;\s*\}/gs,
  `.mc-input, .mc-select, .mc-textarea {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-body);
  color: var(--text-main);
  font-family: inherit;
  font-size: 15px;
  transition: var(--transition-smooth);
  outline: none;
}`
);

// Remove the inline hardcoded body darkmode fallbacks I see from grep earlier
css = css.replace(/body \s*\{[\s\S]*?\}/, '');

fs.writeFileSync(path, css);
console.log('App.css updated for premium glassmorphism and modern UI tokens.');
