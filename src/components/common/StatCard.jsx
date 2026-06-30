import React from "react";
import Card from "./Card";
import Icon from "../ui/Icon";

const StatCard = ({ iconName, value, label, valueClass = "" }) => (
  <Card className="admin-stat-card">
    {iconName && (
      <div className="admin-stat-icon-wrap">
        <Icon name={iconName} size={20} />
      </div>
    )}
    <div className={`admin-stat-value ${valueClass}`.trim()}>{value}</div>
    <div className="admin-stat-label">{label}</div>
  </Card>
);

export default StatCard;
