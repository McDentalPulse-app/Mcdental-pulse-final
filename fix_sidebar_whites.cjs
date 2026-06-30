const fs = require('fs');
const path = './src/App.css';
let css = fs.readFileSync(path, 'utf8');

// Replace all hardcoded rgba(255, 255, 255, X) inside sidebar classes
// We'll just replace the most offensive text color rules with var(--text-muted)
// and borders with var(--border-color)
css = css.replace(/\.sidebar-brand-sub\s*\{\s*font-size: 10px;\s*color: rgba\(255, 255, 255, 0\.55\);/g, '.sidebar-brand-sub {\n  font-size: 10px;\n  color: var(--text-muted);');
css = css.replace(/\.sidebar-ai-badge\s*\{([^}]+)color: rgba\(255, 255, 255, 0\.72\);([^}]+)\}/g, '.sidebar-ai-badge {$1color: var(--text-muted);$2}');
css = css.replace(/\.sidebar-nav-btn\s*\{([^}]+)color: rgba\(255, 255, 255, 0\.82\);([^}]+)\}/g, '.sidebar-nav-btn {$1color: var(--text-main);$2}');
css = css.replace(/\.sidebar-nav-icon\s*\{([^}]+)color: rgba\(255, 255, 255, 0\.88\);([^}]+)\}/g, '.sidebar-nav-icon {$1color: var(--text-main);$2}');
css = css.replace(/\.sidebar-user-role\s*\{\s*font-size: 10px;\s*color: rgba\(255, 255, 255, 0\.52\);/g, '.sidebar-user-role {\n  font-size: 10px;\n  color: var(--text-muted);');

// Clean up background white rgba's that might look bad in light mode
css = css.replace(/background: rgba\(255, 255, 255, 0\.06\)/g, 'background: var(--bg-subtle)');
css = css.replace(/border: 1px solid rgba\(255, 255, 255, 0\.08\)/g, 'border: 1px solid var(--border-color)');
css = css.replace(/background: rgba\(255, 255, 255, 0\.14\)/g, 'background: var(--bg-subtle)');
css = css.replace(/background: rgba\(255, 255, 255, 0\.15\)/g, 'background: var(--bg-subtle)');
css = css.replace(/background: rgba\(255, 255, 255, 0\.08\)/g, 'background: var(--bg-subtle)');
css = css.replace(/border: 1px solid rgba\(255, 255, 255, 0\.1\)/g, 'border: 1px solid var(--border-color)');
css = css.replace(/background: rgba\(255, 255, 255, 0\.2\)/g, 'background: var(--bg-hover)');
css = css.replace(/background: rgba\(255, 255, 255, 0\.22\)/g, 'background: var(--bg-hover)');
css = css.replace(/background: rgba\(255, 255, 255, 0\.04\)/g, 'background: transparent');
css = css.replace(/background: rgba\(255, 255, 255, 0\.18\)/g, 'background: var(--bg-hover)');

fs.writeFileSync(path, css);
console.log('Fixed sidebar text and background hardcoded white colors in App.css');
