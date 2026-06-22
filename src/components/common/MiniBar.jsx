import React from "react";

const MiniBar = ({ data, colorFn, labelKey = "label" }) => {
  const values = data.map(d => d.value ?? d.v ?? 0);
  const max = Math.max(...values, 1);

  return (
    <div className="mc-minibar">
      {data.map((d, i) => {
        const val = d.value ?? d.v ?? 0;
        const barColor = colorFn ? colorFn({ ...d, value: val, v: val }) : "#006D5B";
        const fullLabel = d.label ?? "";
        const displayLabel = d[labelKey] ?? fullLabel;
        return (
          <div key={i} className="mc-minibar-col" title={fullLabel}>
            <div className="mc-minibar-val">{val || "—"}</div>
            <div
              className="mc-minibar-bar"
              style={{
                height: Math.max(8, (val / max) * 64),
                background: barColor,
              }}
            />
            <div className="mc-minibar-label">{displayLabel}</div>
          </div>
        );
      })}
    </div>
  );
};

export default MiniBar;
