import React from "react";
import { semaforoBg, semaforoColor, semaforoLabel } from "../../config/theme";

const Badge = ({ tipo }) => (
  <span style={{ 
    background: semaforoBg[tipo] || "#f1f5f9", 
    color: semaforoColor[tipo] || "#475569", 
    padding: "2px 10px", 
    borderRadius: 999, 
    fontSize: 12, 
    fontWeight: 700, 
    display: "inline-flex", 
    alignItems: "center", 
    gap: 4 
  }}>
    <span style={{ 
      width: 7, 
      height: 7, 
      borderRadius: "50%", 
      background: semaforoColor[tipo] || "#94a3b8", 
      display: "inline-block" 
    }} />
    {semaforoLabel[tipo] || tipo}
  </span>
);

export default Badge;
