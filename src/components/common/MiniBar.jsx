import React from "react";

const MiniBar = ({ data, colorFn, labelKey = "label" }) => {
  const getVal = (d) => {
    if (d.hasData === false) return null;
    const raw = d.value ?? d.v;
    if (raw == null || raw === "") return null;
    return Number(raw);
  };

  const values = data.map(getVal).filter((v) => v != null && Number.isFinite(v));
  const max = Math.max(...values, 1);

  return (
    <div className="mc-minibar mc-minibar--dashboard">
      {data.map((d, i) => {
        const val = getVal(d);
        const sinDatos = val == null || !Number.isFinite(val);
        const displayVal = sinDatos ? "—" : val;
        const barColor = sinDatos
          ? "#cbd5e1"
          : colorFn
            ? colorFn({ ...d, value: val, v: val, hasData: !sinDatos })
            : "#006D5B";
        const fullLabel = d.label ?? "";
        const displayLabel = d[labelKey] ?? fullLabel;

        return (
          <div
            key={i}
            className={`mc-minibar-col${sinDatos ? " mc-minibar-col--empty" : ""}`}
            title={fullLabel}
          >
            <div className={`mc-minibar-val${sinDatos ? " mc-minibar-val--empty" : ""}`}>
              {displayVal}
            </div>
            <div
              className="mc-minibar-bar"
              style={{
                height: sinDatos ? 10 : Math.max(10, (val / max) * 64),
                background: barColor,
                opacity: sinDatos ? 0.55 : 1,
              }}
            />
            <div className="mc-minibar-label" title={fullLabel}>
              {displayLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MiniBar;
