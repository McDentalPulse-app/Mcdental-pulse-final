import React from "react";
import Card from "./Card";
import { UI } from "../../config/theme";
import Icon from "../ui/Icon";

const KPI = ({ label, value, sub, color = UI.verdeMedio, iconName }) => (
  <Card className="mc-kpi">
    <div className="mc-kpi-glow" style={{ background: `${color}10` }} />
    {iconName && (
      <div className="mc-kpi-icon" style={{ background: `${color}12`, color }}>
        <Icon name={iconName} size={20} />
      </div>
    )}
    <div className="mc-kpi-value" style={{ color }}>{value}</div>
    <div className="mc-kpi-label">{label}</div>
    {sub && <div className="mc-kpi-sub">{sub}</div>}
  </Card>
);

export default KPI;
