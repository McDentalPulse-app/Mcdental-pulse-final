import {
  Bar, CartesianGrid, ComposedChart, Label, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { getPulseStatus } from "../../utils/pulseScore";
import { nivelColor } from "../../config/theme";

/**
 * Pulse Score de cada sucursal en UNA semana.
 *
 * POR QUÉ REEMPLAZA A LAS BARRAS AGRUPADAS: la gráfica anterior ponía seis semanas de golpe con
 * una barra por sucursal dentro de cada semana, y con 26 clínicas eso son 156 barras. No cabían:
 * el código las recortaba a las 8 primeras (`.slice(0, 8)`), así que la pantalla llevaba tiempo
 * enseñando un tercio de la empresa sin decirlo. Ahora se elige la semana y se ven TODAS.
 *
 * POR QUÉ RECHARTS Y NO SVG A MANO: la primera versión de esta pantalla se dibujó a mano y se
 * parecía, pero no era igual — ni las animaciones, ni la alineación de los ejes, ni el tooltip
 * que sigue al ratón (un `<title>` de SVG lo pinta el sistema operativo, tarda un segundo y no
 * se puede maquetar). Recharts es lo que usa el diseño de referencia. Pesa, pero en esta app el
 * bundle ya carga 15 MB de OpenCV para el reconocimiento facial: es marginal al lado de eso.
 *
 * EL COLOR ES EL SEMÁFORO, no un color por clínica. Con 26 series, 26 colores dejan de
 * distinguirse entre sí y la leyenda ocupa más que la gráfica — y sobre todo obligan a mirar la
 * leyenda para responder la única pregunta que importa: cuáles están mal. Verde/amarillo/rojo lo
 * contesta de un vistazo, y es el mismo código que la app usa en todas las demás pantallas.
 *
 * La línea punteada es la MISMA sucursal la semana anterior. Es lo que convierte una foto en una
 * tendencia: sin ella, un 72 no se distingue de un 72 que viene de 85.
 */

/**
 * ¿Hay un número de verdad aquí?
 *
 * `Number.isFinite(Number(v))` NO vale, y el fallo se vio dibujándolo: `Number(null)` es 0 y
 * `Number("")` también, así que una sucursal SIN dato de la semana anterior pasaba el filtro como
 * si hubiera sacado un cero, y la línea punteada se desplomaba al suelo entre barras inventando
 * caídas que nunca ocurrieron.
 */
const esNumero = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

/** Nombre corto para el eje. El completo se queda en el tooltip. */
const nombreCorto = (n = "") =>
  n
    .replace(/^McDental\s+/i, "")
    .replace(/^Popular\s+/i, "Pop. ")
    .replace(/^Oficina Administrativa$/i, "Oficina");

/**
 * El tooltip. Sustituye al `ChartTooltipContent` de Untitled UI, que no está en este proyecto
 * (solo tenemos su paquete de iconos, no su librería de componentes).
 */
const TooltipContenido = ({ active, payload, semanaLabel, semanaPreviaLabel }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const delta = esNumero(d.previo) ? d.score - d.previo : null;

  return (
    <div className="mc-chart-tooltip">
      <p className="mc-chart-tooltip-titulo">{d.sucursal}</p>
      <p className="mc-chart-tooltip-fila">
        <span className="mc-chart-tooltip-punto" style={{ background: nivelColor(getPulseStatus(d.score).nivel) }} />
        {`${semanaLabel}: `}
        <strong>{d.score}</strong>
      </p>
      {esNumero(d.previo) && (
        <p className="mc-chart-tooltip-fila mc-chart-tooltip-fila--tenue">
          <span className="psico-trend-dash" />
          {`${semanaPreviaLabel || "Semana anterior"}: ${d.previo} `}
          <strong>{`(${delta >= 0 ? "+" : ""}${delta})`}</strong>
        </p>
      )}
      {d.respuestas ? (
        <p className="mc-chart-tooltip-pie">{`${d.respuestas} respuesta${d.respuestas === 1 ? "" : "s"}`}</p>
      ) : null}
    </div>
  );
};

const WeeklyScoreChart = ({ datos = [], semanaLabel = "", semanaPreviaLabel = null, height = 300 }) => {
  const filas = datos.filter((d) => esNumero(d.score));
  if (!filas.length) return null;

  // De mayor a menor: con 26 barras, el orden alfabético obliga a recorrerlas todas para saber
  // quién está peor. Ordenadas, el problema está siempre en el mismo sitio — a la derecha.
  const data = [...filas]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .map((d) => ({
      sucursal: d.sucursal,
      corto: nombreCorto(d.sucursal),
      score: Number(d.score),
      // `undefined` y no `null`: recharts corta la línea donde falta el dato, y así no une dos
      // sucursales salteándose una intermedia inventando una pendiente que nadie midió.
      previo: esNumero(d.scorePrevio) ? Number(d.scorePrevio) : undefined,
      respuestas: d.respuestas,
    }));

  // Con 26 clínicas no caben en el ancho de la tarjeta: se desplaza en horizontal en vez de
  // encogerse hasta ser ilegible. 52px por barra deja que el nombre girado se lea sin pisarse.
  const anchoMin = Math.max(320, data.length * 52);

  return (
    <div className="mc-chart-scroll">
      <div style={{ width: "100%", minWidth: anchoMin, height }}>
        {/* `initialDimension` con la medida real y no el 1x1 del ejemplo: sin ella, el primer
            render de recharts no tiene tamaño y la gráfica parpadea vacía antes de aparecer. */}
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: anchoMin, height }}>
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 16, bottom: 46 }}>
            {/* Solo horizontal: las verticales no aportan nada cuando el eje X son categorías,
                y con 26 barras convierten el fondo en una reja. */}
            <CartesianGrid vertical={false} stroke="var(--mc-gris-suave)" />

            <XAxis
              dataKey="corto"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={70}
              tick={{ fill: "var(--mc-texto-secundario)", fontSize: 11 }}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              axisLine={false}
              tickLine={false}
              width={44}
              tick={{ fill: "var(--mc-texto-secundario)", fontSize: 11 }}
            >
              <Label
                value="Pulse Score"
                fill="var(--mc-texto-secundario)"
                style={{ textAnchor: "middle", fontSize: 11, fontWeight: 600 }}
                angle={-90}
                position="insideLeft"
              />
            </YAxis>

            <Tooltip
              content={<TooltipContenido semanaLabel={semanaLabel} semanaPreviaLabel={semanaPreviaLabel} />}
              cursor={{ fill: "var(--mc-gris-suave)", fillOpacity: 0.35 }}
            />

            {/* Una celda por barra: el color sale del semáforo de CADA sucursal, no de la serie.
                Es lo que permite que verde, amarillo y rojo convivan en la misma barra. */}
            {/* `isAnimationActive={false}` es lo que trae el diseño de referencia, y no es un
                descuido suyo: recharts REANIMA en cada re-render, así que al cambiar de semana —o
                al re-renderizarse el dashboard por cualquier otra cosa— las 26 barras volverían a
                crecer desde cero delante de quien esté leyéndolas. Además es la única versión que
                he podido verificar renderizada. Se enciende cambiando esta línea. */}
            <Bar dataKey="score" maxBarSize={18} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.sucursal} fill={nivelColor(getPulseStatus(d.score).nivel)} />
              ))}
            </Bar>

            <Line
              dataKey="previo"
              name="Semana anterior"
              type="monotone"
              stroke="var(--mc-texto-secundario)"
              strokeWidth={2}
              strokeDasharray="0.1 8"
              strokeLinecap="round"
              // El punto sí se dibuja, al revés que en el ejemplo: aquí una sucursal puede tener
              // dato previo con las dos vecinas sin él, y un tramo de un solo punto sin `dot`
              // sería invisible — ese "veníamos de 83" desaparecería sin avisar.
              dot={{ r: 2.5, fill: "var(--mc-texto-secundario)", strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeeklyScoreChart;
