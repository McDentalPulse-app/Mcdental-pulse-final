import React, { useId } from "react";
import { nivelColor, colorMarca } from "../../config/theme";

/**
 * Antes recibía `color` como hex (por defecto #006D5B — un quinto verde distinto de los
 * otros cuatro del proyecto) y además tenía tres colores clavados en el SVG:
 * `stroke="#fff"` en los puntos y `fill="#334155"` / `#64748b` en las etiquetas. En modo
 * oscuro, el halo blanco y el texto gris oscuro quedaban ilegibles.
 *
 * Ahora la serie se pinta con `currentColor`, heredado del contenedor: así el color lo
 * decide el CSS a partir del `slug`, y las etiquetas y el halo usan tokens que cambian con
 * el tema. El `id` del gradiente sale de useId() — antes se construía a partir del hex, y
 * con una variable CSS (que lleva paréntesis) habría generado un id inválido.
 */
const LineChart = ({ data, slug, height = 120 }) => {
  const uid = useId().replace(/:/g, "");

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
  const gradId = `lineGrad-${uid}`;

  return (
    // El color de la serie vive aquí: el SVG lo hereda con currentColor.
    <div className="dashboard-line-chart-wrap" style={{ color: slug ? nivelColor(slug) : colorMarca }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="dashboard-line-chart"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Gráfica de tendencia semanal"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <g key={i}>
            {/* El halo del punto es el color de la tarjeta, no blanco fijo: así sigue
                recortando contra el fondo también en modo oscuro. */}
            <circle
              cx={p.x}
              cy={p.y}
              r="5.5"
              fill="currentColor"
              stroke="var(--mc-superficie)"
              strokeWidth="2.5"
            />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="var(--mc-texto)"
            >
              {p.v}
            </text>
            <text
              x={p.x}
              y={h - 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="var(--mc-texto-secundario)"
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
