import {
  Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis,
} from "recharts";
import { etiquetaDePeriodo } from "../../utils/periodos";

/**
 * La línea de las últimas N encuestas de una persona, con dos rayas de referencia en 60 y 80 —
 * los mismos umbrales de semaforoDeScore()/getPulseStatus() (ver utils/pulseScore.js), no un
 * adorno: son la frontera real entre rojo, amarillo y verde.
 *
 * Sin eje X visible a propósito: con 8 puntos, una semana como "2026-W38" once veces no cabe
 * legible, y el dato que importa (el valor) ya va escrito sobre cada punto. El eje X sigue
 * existiendo para el tooltip, solo que oculto.
 */
const TooltipContenido = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="mc-chart-tooltip">
      <p className="mc-chart-tooltip-titulo">{etiquetaDePeriodo(d.semana)}</p>
      <p className="mc-chart-tooltip-fila"><strong>{d.score}</strong> pts</p>
    </div>
  );
};

const PuntoEtiquetado = (props) => {
  const { x, y, value } = props;
  return (
    <text x={x} y={y - 10} textAnchor="middle" className="mc-pulse-trend-valor">
      {value}
    </text>
  );
};

const PulseTrendChart = ({ datos = [], height = 130 }) => {
  const data = datos.map((d) => ({ semana: d.semana, score: Number(d.score) }));
  if (!data.length) return null;

  return (
    <div className="mc-pulse-trend" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <LineChart data={data} margin={{ top: 18, right: 10, bottom: 4, left: 10 }}>
          <YAxis domain={[0, 100]} hide />
          <ReferenceLine y={60} stroke="var(--mc-texto-secundario)" strokeDasharray="3 5" />
          <ReferenceLine y={80} stroke="var(--mc-texto-secundario)" strokeDasharray="3 5" />
          <Tooltip content={<TooltipContenido />} cursor={{ stroke: "var(--mc-gris-suave)" }} />
          <Line
            dataKey="score"
            type="monotone"
            stroke="var(--mc-verde)"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "var(--mc-verde)", stroke: "var(--mc-superficie)", strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            label={<PuntoEtiquetado />}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PulseTrendChart;
