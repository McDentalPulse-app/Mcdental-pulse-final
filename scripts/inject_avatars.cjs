const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/ia/AIEngine.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace in Resumen
content = content.replace(
  /<div className="ai-resumen-item-head">[\s\S]*?<div>[\s\S]*?<div className="ai-resumen-name">\{a\.empleado\.name\}<\/div>[\s\S]*?<div className="ai-resumen-meta">\{normalizeSucursal\(a\.empleado\.sucursal\)\} · \{a\.empleado\.puesto\}<\/div>[\s\S]*?<\/div>/g,
  \`<div className="ai-resumen-item-head" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <Avatar name={a.empleado.name} size={48} color={a.status?.color || "var(--mc-aqua)"} />
              <div style={{ flex: 1 }}>
                <div className="ai-resumen-name" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{a.empleado.name}</div>
                <div className="ai-resumen-meta" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}</div>
              </div>\`
);

// Replace in Alertas and Prediccion
content = content.replace(
  /<div className="ai-alerta-head">[\s\S]*?<div>[\s\S]*?<div className="ai-alerta-name">[\s\S]*?\{a\.empleado\.name\}[\s\S]*?<\/div>[\s\S]*?<div className="ai-alerta-meta">[\s\S]*?\{normalizeSucursal\(a\.empleado\.sucursal\)\} · \{a\.empleado\.puesto\}[\s\S]*?<\/div>[\s\S]*?<\/div>/g,
  \`<div className="ai-alerta-head" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                <Avatar name={a.empleado.name} size={48} color={a.status?.color || "var(--mc-aqua)"} />
                <div style={{ flex: 1 }}>
                  <div className="ai-alerta-name" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{a.empleado.name}</div>
                  <div className="ai-alerta-meta" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{normalizeSucursal(a.empleado.sucursal)} · {a.empleado.puesto}</div>
                </div>\`
);

fs.writeFileSync(filePath, content);
console.log("Avatares inyectados exitosamente en las pestañas restantes.");
