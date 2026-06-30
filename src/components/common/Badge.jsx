import React from "react";
import { semaforoLabel } from "../../config/theme";

const Badge = ({ tipo }) => (
  <span className={`mc-badge mc-badge--${tipo || "default"}`}>
    <span className="mc-badge-dot" />
    {semaforoLabel[tipo] || tipo}
  </span>
);

export default Badge;
