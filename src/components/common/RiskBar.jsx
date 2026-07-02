import React from "react";

const RiskBar = ({ label, value, color }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
      <span className="mc-riskbar-label" style={{ color: "var(--mc-texto-secundario)", fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}%</span>
    </div>
    <div className="mc-riskbar-track" style={{ height: 8, background: "var(--mc-riskbar-track)", borderRadius: 99 }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 99, transition: "width .5s" }} />
    </div>
  </div>
);

export default RiskBar;
