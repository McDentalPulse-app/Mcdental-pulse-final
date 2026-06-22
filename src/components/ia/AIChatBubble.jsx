import React from "react";
import Icon from "../ui/Icon";

const AIChatBubble = ({ mensaje, loading }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
    <div className="admin-stat-icon-wrap" style={{ width: 32, height: 32, borderRadius: "50%", marginBottom: 0, flexShrink: 0 }}>
      <Icon name="ai" size={16} />
    </div>
    <div style={{ flex: 1, background: "#f8fafc", border: "1px solid var(--mc-gris-suave)", borderRadius: "0 12px 12px 12px", padding: "12px 16px", fontSize: 13, color: "#111827", lineHeight: 1.6 }}>
      {loading ? (
        <span style={{ color: "#9ca3af", display: "inline-flex", alignItems: "center", gap: 6 }}>
          Analizando datos... <Icon name="sparkles" size={14} />
        </span>
      ) : mensaje}
    </div>
  </div>
);


export default AIChatBubble;
