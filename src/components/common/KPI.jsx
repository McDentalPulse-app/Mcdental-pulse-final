import React from "react";
import Card from "./Card";
import { UI } from "../../config/theme";

const KPI = ({ label, value, sub, color = UI.verdeMedio, icon }) => (
  <Card
    style={{
      flex: 1,
      minWidth: 150,
      padding: 20,
      position: "relative",
      overflow: "hidden"
    }}
  >
    <div
      style={{
        position: "absolute",
        right: -22,
        top: -22,
        width: 90,
        height: 90,
        borderRadius: "50%",
        background: `${color}14`
      }}
    />

    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: 14,
        background: `${color}18`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        marginBottom: 14,
        position: "relative",
        zIndex: 1
      }}
    >
      {icon}
    </div>

    <div
      style={{
        fontSize: 34,
        fontWeight: 950,
        color,
        lineHeight: 1,
        letterSpacing: "-1px",
        position: "relative",
        zIndex: 1
      }}
    >
      {value}
    </div>

    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: "#0f172a",
        marginTop: 8,
        position: "relative",
        zIndex: 1
      }}
    >
      {label}
    </div>

    {sub && (
      <div
        style={{
          fontSize: 11,
          color: UI.grisTexto,
          marginTop: 4,
          position: "relative",
          zIndex: 1
        }}
      >
        {sub}
      </div>
    )}
  </Card>
);

export default KPI;
