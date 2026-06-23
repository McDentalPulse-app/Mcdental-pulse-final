import React from "react";

const LineChart = ({ data, color = "#006D5B", height = 120 }) => {
  if (!data || data.length < 2) return null;

  const values = data.map((d) => Number(d.v)).filter((v) => Number.isFinite(v));
  if (values.length < 2) return null;

  const w = 320;
  const h = height;
  const topPad = 22;
  const bottomPad = 26;
  const chartH = h - topPad - bottomPad;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const padMin = max === min ? min - 8 : min;
  const padMax = max === min ? max + 8 : max;
  const range = padMax - padMin || 1;

  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * (w - 24) + 12,
    y: topPad + chartH - ((Number(d.v) - padMin) / range) * chartH,
    v: d.v,
    label: d.label,
  }));

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${h - 8} L${pts[0].x},${h - 8} Z`;
  const gradId = `lineGrad${color.replace("#", "")}`;

  return (
    <div className="dashboard-line-chart-wrap">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="dashboard-line-chart"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Gráfica de tendencia semanal"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5.5" fill={color} stroke="#fff" strokeWidth="2.5" />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#334155"
            >
              {p.v}
            </text>
            <text
              x={p.x}
              y={h - 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#64748b"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default LineChart;
