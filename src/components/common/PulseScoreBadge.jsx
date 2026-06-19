import React from "react";

const PulseScoreBadge = ({ score, nivel, color, tendencia, size = "md" }) => {
  const fs = size === "lg" ? 36 : size === "sm" ? 18 : 24;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${color}18`, border: `1.5px solid ${color}40`, borderRadius: 12, padding: size === "lg" ? "10px 16px" : "6px 12px" }}>
      <div style={{ fontSize: fs, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
      <div>
        <div style={{ fontSize: size === "sm" ? 9 : 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5 }}>Pulse Score™</div>
        <div style={{ fontSize: size === "sm" ? 9 : 11, color: "#6b7280" }}>{nivel} {tendencia}</div>
      </div>
    </div>
  );
};

export default PulseScoreBadge;
