import React from "react";

const RiskBar = ({ label, value, color }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: "#374151", fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}%</span>
    </div>
    <div style={{ height: 8, background: "#f3f4f6", borderRadius: 99 }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 99, transition: "width .5s" }} />
    </div>
  </div>
);

export default RiskBar;
