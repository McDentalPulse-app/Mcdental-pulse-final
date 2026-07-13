import React from "react";

const MiniBar = ({
  data,
  colorFn,
  labelKey = "label",
  onBarClick,
  interactive = false,
}) => {
  const getVal = (d) => {
    if (d.hasData === false) return null;
    const raw = d.value ?? d.v;
    if (raw == null || raw === "") return null;
    return Number(raw);
  };

  const values = data.map(getVal).filter((v) => v != null && Number.isFinite(v));
  const max = Math.max(...values, 1);

  const handleActivate = (d, i) => {
    if (interactive && onBarClick) onBarClick(d, i);
  };

  return (
    <div className="mc-minibar mc-minibar--dashboard mc-minibar--premium">
      {data.map((d, i) => {
        const val = getVal(d);
        const sinDatos = val == null || !Number.isFinite(val);
        const displayVal = sinDatos ? "—" : val;
        // Antes: "#e8edf2" (gris muy claro, invisible sobre tarjeta oscura) y "#006D5B"
        // (otro verde distinto al de la marca). Ahora tokens, que cambian con el tema.
        // `colorFn` la pone el llamador y ya devuelve una variable CSS, no un hex.
        const barColor = sinDatos
          ? "var(--mc-riskbar-track)"
          : colorFn
            ? colorFn({ ...d, value: val, v: val, hasData: !sinDatos })
            : "var(--mc-verde)";
        const fullLabel = d.label ?? "";
        const displayLabel = d[labelKey] ?? fullLabel;
        const clickable = interactive && typeof onBarClick === "function";
        const barHeight = sinDatos ? 16 : Math.max(18, (val / max) * 92);

        return (
          <div
            key={d.label ?? i}
            className={`mc-minibar-col${sinDatos ? " mc-minibar-col--empty" : ""}${clickable ? " mc-minibar-col--clickable" : ""}`}
            title={fullLabel}
            onClick={() => handleActivate(d, i)}
            onKeyDown={(e) => {
              if (clickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                handleActivate(d, i);
              }
            }}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `Ver detalle de ${fullLabel}` : undefined}
          >
            <div className={`mc-minibar-val${sinDatos ? " mc-minibar-val--empty" : ""}`}>
              {displayVal}
            </div>
            <div className="mc-minibar-bar-track">
              <div
                className={`mc-minibar-bar${sinDatos ? " mc-minibar-bar--empty" : ""}`}
                style={{
                  height: barHeight,
                  background: barColor,
                }}
              />
            </div>
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
