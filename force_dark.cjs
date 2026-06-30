const fs = require('fs');
const file = 'src/App.css';
let content = fs.readFileSync(file, 'utf8');

// Replace light backgrounds with dark glass
content = content.replace(/background:\s*#fff(?:fff)?\b/gi, 'background: rgba(15, 23, 42, 0.5)');
content = content.replace(/background-color:\s*#fff(?:fff)?\b/gi, 'background-color: rgba(15, 23, 42, 0.5)');
content = content.replace(/background:\s*white\b/gi, 'background: rgba(15, 23, 42, 0.5)');
content = content.replace(/background-color:\s*white\b/gi, 'background-color: rgba(15, 23, 42, 0.5)');
content = content.replace(/background:\s*#f8fafc\b/gi, 'background: rgba(0, 0, 0, 0.2)');
content = content.replace(/background-color:\s*#f8fafc\b/gi, 'background-color: rgba(0, 0, 0, 0.2)');
content = content.replace(/background:\s*#f1f5f9\b/gi, 'background: rgba(0, 0, 0, 0.3)');

// Text colors
content = content.replace(/color:\s*#0f172a\b/gi, 'color: #ffffff');
content = content.replace(/color:\s*#1e293b\b/gi, 'color: #ffffff');
content = content.replace(/color:\s*#334155\b/gi, 'color: #e2e8f0');
content = content.replace(/color:\s*#475569\b/gi, 'color: #cbd5e1');
content = content.replace(/color:\s*#64748b\b/gi, 'color: #94a3b8');

// Borders
content = content.replace(/border:\s*1px solid #e2e8f0\b/gi, 'border: 1px solid rgba(255, 255, 255, 0.08)');
content = content.replace(/border-bottom:\s*1px solid #e2e8f0\b/gi, 'border-bottom: 1px solid rgba(255, 255, 255, 0.08)');
content = content.replace(/border-top:\s*1px solid #e2e8f0\b/gi, 'border-top: 1px solid rgba(255, 255, 255, 0.08)');
content = content.replace(/border-color:\s*#e2e8f0\b/gi, 'border-color: rgba(255, 255, 255, 0.08)');

fs.writeFileSync(file, content);
console.log("App.css forced to dark mode.");
