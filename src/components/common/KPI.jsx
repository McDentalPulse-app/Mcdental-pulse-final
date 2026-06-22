import React from "react";
import Card from "./Card";
import { UI } from "../../config/theme";

const KPI = ({ label, value, sub, color = UI.verdeMedio, icon }) => (
  <Card className="mc-kpi">
    <div className="mc-kpi-glow" style={{ background: `${color}14` }} />
    <div className="mc-kpi-icon" style={{ background: `${color}18`, color }}>
      {icon}
    </div>
    <div className="mc-kpi-value" style={{ color }}>{value}</div>
    <div className="mc-kpi-label">{label}</div>
    {sub && <div className="mc-kpi-sub">{sub}</div>}
  </Card>
);

export default KPI;
