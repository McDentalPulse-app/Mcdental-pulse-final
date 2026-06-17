import React from "react";

const LineChart = ({ data, color = "#006D5B", height = 80 }) => {
  if (!data || data.length < 2) return null;
  const w = 300, h = height;
  const max = Math.max(...data.map(d => d.v), 1); const min = Math.min(...data.map(d => d.v));
  const pts = data.map((d, i) => ({ x: (i / (data.length - 1)) * (w - 20) + 10, y: h - 10 - ((d.v - min) / (max - min + 1)) * (h - 20) }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <defs><linearGradient id={`g${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#g${color.replace("#","")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} stroke="#fff" strokeWidth="2" />)}
      {data.map((d, i) => <text key={i} x={pts[i].x} y={h} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.label}</text>)}
    </svg>
  );
};

export default LineChart;
