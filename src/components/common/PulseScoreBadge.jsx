import React from "react";

const PulseScoreBadge = ({ score, nivel, color, tendencia, size = "md" }) => {
  const sizeClass = size === "lg" ? "mc-pulse-badge--lg" : size === "sm" ? "mc-pulse-badge--sm" : "";
  const displayScore = score == null ? "—" : score;
  return (
    <div className={`mc-pulse-badge ${sizeClass}`.trim()} style={{ background: `${color}14`, borderColor: `${color}35` }}>
      <div className="mc-pulse-badge-score" style={{ color, fontSize: size === "lg" ? 36 : size === "sm" ? 18 : 24 }}>{displayScore}</div>
      <div>
        <div className="mc-pulse-badge-label" style={{ color }}>Pulse Score™</div>
        <div className="mc-pulse-badge-meta">{nivel} {tendencia}</div>
      </div>
    </div>
  );
};

export default PulseScoreBadge;
