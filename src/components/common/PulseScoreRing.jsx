import { nivelColor } from "../../config/theme";

/**
 * El anillo del Pulse Score: un gauge circular con el número al centro, como el que enseña la
 * app de asistencia (referencia del becario). `PulseScoreBadge` (la caja rectangular que ya
 * existe) sigue viva para los dashboards de admin/RH/psicóloga — este es su equivalente en
 * anillo para la pantalla de inicio del empleado, mismo color por semáforo.
 */
const PulseScoreRing = ({ score, slug = "sin-datos", size = 132, strokeWidth = 10 }) => {
  const radio = (size - strokeWidth) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = nivelColor(slug);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mc-pulse-ring">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radio}
        fill="none"
        stroke="var(--mc-gris-suave)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radio}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        strokeDashoffset={circunferencia * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="mc-pulse-ring-valor"
        style={{ fill: color }}
      >
        {score == null ? "—" : score}
      </text>
    </svg>
  );
};

export default PulseScoreRing;
