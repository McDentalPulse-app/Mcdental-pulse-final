const fs = require('fs');
const file = '/home/helminth/Proyects/Mcdental-pulse-final-main/src/components/ia/AIEngine.jsx';
let content = fs.readFileSync(file, 'utf8');

// Helper to replace hardcoded colors
content = content.replace(/background:\s*"#f8fafc"/g, 'background: "rgba(255, 255, 255, 0.03)"');
content = content.replace(/background:\s*"white"/g, 'background: "rgba(255, 255, 255, 0.05)"');
content = content.replace(/background:\s*"#fff"/g, 'background: "rgba(255, 255, 255, 0.05)"');
content = content.replace(/background:\s*"#ecfeff"/g, 'background: "rgba(0, 200, 180, 0.1)"');
content = content.replace(/background:\s*"#fef2f2"/g, 'background: "rgba(239, 68, 68, 0.1)"');
content = content.replace(/background:\s*"#fff7ed"/g, 'background: "rgba(249, 115, 22, 0.1)"');
content = content.replace(/background:\s*"#fffbeb"/g, 'background: "rgba(234, 179, 8, 0.1)"');
content = content.replace(/background:\s*"#fff7ed"/g, 'background: "rgba(255, 255, 255, 0.05)"');

content = content.replace(/color:\s*"#0f172a"/g, 'color: "var(--text-main)"');
content = content.replace(/color:\s*"#334155"/g, 'color: "var(--text-light)"');
content = content.replace(/color:\s*"#475569"/g, 'color: "var(--text-light)"');
content = content.replace(/color:\s*"#64748b"/g, 'color: "var(--text-muted)"');
content = content.replace(/color:\s*"#004D40"/g, 'color: "var(--mc-aqua)"');

content = content.replace(/border:\s*"1px solid #e5e7eb"/g, 'border: "1px solid rgba(255,255,255,0.1)"');
content = content.replace(/border:\s*"1px solid #bae6fd"/g, 'border: "1px solid rgba(255,255,255,0.1)"');

// Inject output display and generate button for Resumen
content = content.replace(
  '<SectionTitle icon="brain">Análisis local por reglas</SectionTitle>',
  `<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <SectionTitle icon="brain">Análisis local por reglas</SectionTitle>
      <button className="mc-btn-primary mc-btn-with-icon" onClick={generarResumen} disabled={loading}>
         <Icon name="ai" size={16} /> {loading ? "Generando..." : "Sintetizar con IA"}
      </button>
    </div>
    {output && (
      <div style={{ padding: 16, background: "rgba(0,200,180,0.05)", borderRadius: 12, border: "1px solid var(--mc-aqua)", marginBottom: 20 }}>
         <div style={{ color: "var(--mc-aqua)", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
           <Icon name="sparkles" size={16} /> Resultado IA
         </div>
         <div style={{ whiteSpace: "pre-wrap", color: "var(--text-light)", lineHeight: 1.6 }}>{output}</div>
      </div>
    )}`
);

// Inject output display and generate button for Alertas
content = content.replace(
  '<SectionTitle icon="shieldAlert">Alertas IA</SectionTitle>',
  `<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <SectionTitle icon="shieldAlert">Alertas IA</SectionTitle>
      <button className="mc-btn-primary mc-btn-with-icon" onClick={generarAlertas} disabled={loading}>
         <Icon name="ai" size={16} /> {loading ? "Generando..." : "Generar Alertas IA"}
      </button>
    </div>
    {output && (
      <div style={{ padding: 16, background: "rgba(239,68,68,0.05)", borderRadius: 12, border: "1px solid #ef4444", marginBottom: 20 }}>
         <div style={{ color: "#ef4444", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
           <Icon name="sparkles" size={16} /> Alertas de IA Activas
         </div>
         <div style={{ whiteSpace: "pre-wrap", color: "var(--text-light)", lineHeight: 1.6 }}>{output}</div>
      </div>
    )}`
);

// Inject output display and generate button for Predicciones
content = content.replace(
  '<SectionTitle icon="wand">Predicciones IA</SectionTitle>',
  `<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <SectionTitle icon="wand">Predicciones IA</SectionTitle>
      <button className="mc-btn-primary mc-btn-with-icon" onClick={generarPrediccion} disabled={loading}>
         <Icon name="ai" size={16} /> {loading ? "Generando..." : "Correr Modelo Predictivo"}
      </button>
    </div>
    {output && (
      <div style={{ padding: 16, background: "rgba(168,85,247,0.05)", borderRadius: 12, border: "1px solid #a855f7", marginBottom: 20 }}>
         <div style={{ color: "#a855f7", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
           <Icon name="sparkles" size={16} /> Predicción Generada
         </div>
         <div style={{ whiteSpace: "pre-wrap", color: "var(--text-light)", lineHeight: 1.6 }}>{output}</div>
      </div>
    )}`
);

// Inject output display for Expedientes IA
content = content.replace(
  '<SectionTitle icon="folderSearch">Expedientes IA</SectionTitle>',
  `<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <SectionTitle icon="folderSearch">Expedientes IA</SectionTitle>
    </div>
    {loading && <div style={{ marginBottom: 16, color: "var(--mc-aqua)" }}><Icon name="loader" size={16} /> Analizando expediente...</div>}
    {output && selectedEmp && (
      <div style={{ padding: 16, background: "rgba(0,200,180,0.05)", borderRadius: 12, border: "1px solid var(--mc-aqua)", marginBottom: 20 }}>
         <div style={{ color: "var(--mc-aqua)", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
           <Icon name="sparkles" size={16} /> Análisis de IA para {selectedEmp.name}
         </div>
         <div style={{ whiteSpace: "pre-wrap", color: "var(--text-light)", lineHeight: 1.6 }}>{output}</div>
      </div>
    )}`
);

// Completely replace Copiloto tab content with Chat UI + the old stats
const copilotoMatch = /\{\/\* Copiloto \*\/\}\n\{tab === "copiloto" && \([\s\S]*?\}\n\)\}/m;
const copilotoReplacement = `\{/* Copiloto */\}
{tab === "copiloto" && (
  <Card>
    <SectionTitle icon="ai">Copiloto de Bienestar Organizacional</SectionTitle>
    <p style={{ color: "var(--text-muted)", marginTop: 0, marginBottom: 20 }}>
      Asistente conversacional con contexto total del equipo y sucursales.
    </p>

    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 400, background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 8 }}>
        {chatHistory.length === 0 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 40 }}>
            <Icon name="ai" size={40} color="var(--mc-aqua)" />
            <p>Hola, soy tu Copiloto de IA. Pregúntame sobre el estado de la organización, riesgos de renuncia o cómo abordar a un empleado.</p>
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div key={idx} style={{ 
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              padding: 14,
              borderRadius: 12,
              background: msg.role === "user" ? "var(--mc-aqua)" : "rgba(255,255,255,0.05)",
              color: msg.role === "user" ? "#fff" : "var(--text-main)",
              border: msg.role === "ai" ? "1px solid rgba(255,255,255,0.1)" : "none"
            }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 4, color: msg.role === "user" ? "rgba(255,255,255,0.8)" : "var(--mc-aqua)" }}>
                {msg.role === "user" ? "Tú" : "Copiloto"}
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14 }}>{msg.text}</div>
            </div>
          ))
        )}
        {chatLoading && (
          <div style={{ alignSelf: "flex-start", color: "var(--mc-aqua)", padding: 14 }}>
            <Icon name="loader" size={18} /> Analizando contexto...
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input 
          style={{ flex: 1, padding: "12px 16px", borderRadius: 8, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
          placeholder="Ej: ¿Qué empleados de Santa Catarina tienen riesgo de renuncia?"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendChat()}
        />
        <button className="mc-btn-primary mc-btn-with-icon" onClick={sendChat} disabled={chatLoading}>
          <Icon name="send" size={16} />
        </button>
      </div>
    </div>
  </Card>
)}`;

content = content.replace(copilotoMatch, copilotoReplacement);

// Fix an issue where `generarResumen` etc. are triggering AI output but there is no explicit visual button on "Expedientes IA".
// Wait, the button for expedientes is in the pulse chips:
// onClick={() => { setTab("expedientes"); analizarEmpleado(emp); }}
// So that is actually wired! It just needed the output rendering which I added above.

fs.writeFileSync(file, content);
console.log('AIEngine.jsx refactored successfully.');
