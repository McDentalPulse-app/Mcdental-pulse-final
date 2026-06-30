import React from "react";

// Barras agrupadas por semana: cada grupo = una semana, cada barra = una oficina
// con su color y su puntaje. Escala fija 0–100 (dominio del Pulse Score).
const GroupedBarChart = ({ labels = [], series = [], height = 200 }) => {
  const hasData = series.some(s => s.values.some(v => Number.isFinite(Number(v))));
  if (!labels.length || !hasData) return null;

  const n = series.length;
  const barW = n > 5 ? 12 : 16;
  const barGap = 3;
  const groupGap = 24;
  const leftPad = 30;
  const rightPad = 10;
  const topPad = 16;
  const bottomPad = 24;

  const groupW = n * barW + (n - 1) * barGap;
  const w = leftPad + labels.length * groupW + (labels.length - 1) * groupGap + rightPad;
  const h = height;
  const chartH = h - topPad - bottomPad;
  const yOf = (v) => topPad + chartH - (Math.max(0, Math.min(100, v)) / 100) * chartH;
  const gridVals = [0, 25, 50, 75, 100];

  return (
    <div className="dashboard-bar-chart-wrap">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="dashboard-bar-chart"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Tendencia de bienestar por oficina (barras por semana)"
      >
        {/* gridlines + eje Y */}
        {gridVals.map(g => (
          <g key={g}>
            <line x1={leftPad} y1={yOf(g)} x2={w - rightPad} y2={yOf(g)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={leftPad - 6} y={yOf(g) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{g}</text>
          </g>
        ))}

        {labels.map((lab, gi) => {
          const gx = leftPad + gi * (groupW + groupGap);
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const v = s.values[gi];
                if (!Number.isFinite(Number(v))) return null;
                const bx = gx + si * (barW + barGap);
                const by = yOf(Number(v));
                const bh = topPad + chartH - by;
                return (
                  <g key={si}>
                    <rect x={bx} y={by} width={barW} height={bh} rx="3" fill={s.color}>
                      <title>{`${s.label} · ${lab}: ${v}`}</title>
                    </rect>
                    <text x={bx + barW / 2} y={by - 4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={s.color}>
                      {v}
                    </text>
                  </g>
                );
              })}
              <text x={gx + groupW / 2} y={h - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748b">
                {lab}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default GroupedBarChart;
