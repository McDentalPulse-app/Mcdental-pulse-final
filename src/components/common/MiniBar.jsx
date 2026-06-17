import React from "react";

const MiniBar = ({ data, colorFn }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}>{d.value}</div>
          <div style={{ width: "100%", height: Math.max(8, (d.value / max) * 60), background: colorFn ? colorFn(d) : "#006D5B", borderRadius: "4px 4px 0 0" }} />
          <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};

export default MiniBar;
