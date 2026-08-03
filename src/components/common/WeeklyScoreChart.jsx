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
 * `Number.isFinite(Number(v))` NO vale, y el fallo se ve solo dibujándolo: `Number(null)` es 0 y
 * `Number(""), Number([])` también, así que una sucursal SIN dato de la semana anterior pasaba el
 * filtro como si hubiera sacado un cero. La línea punteada se desplomaba al suelo entre barras e
 * inventaba caídas a cero que nunca ocurrieron.
 */
const esNumero = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

/** Nombre corto para el eje. El completo se queda en el tooltip. */
const nombreCorto = (n = "") =>
  n
    .replace(/^McDental\s+/i, "")
    .replace(/^Popular\s+/i, "Pop. ")
    .replace(/^Oficina Administrativa$/i, "Oficina");

const WeeklyScoreChart = ({ datos = [], semanaLabel = "", semanaPreviaLabel = null, height = 260 }) => {
  const filas = datos.filter((d) => esNumero(d.score));
  if (!filas.length) return null;

  // De mayor a menor: con 26 barras, el orden alfabético obliga a recorrerlas todas para saber
  // quién está peor. Ordenadas, el problema está siempre en el mismo sitio — a la derecha.
  const orden = [...filas].sort((a, b) => Number(b.score) - Number(a.score));

  const barW = 14;
  const gap = 18;
  const leftPad = 44;
  const rightPad = 16;
  const topPad = 22;
  const bottomPad = 74; // los nombres van girados: necesitan sitio

  const w = leftPad + orden.length * (barW + gap) + rightPad;
  const chartH = height - topPad - bottomPad;
  const yOf = (v) => topPad + chartH - (Math.max(0, Math.min(100, Number(v))) / 100) * chartH;
  const xOf = (i) => leftPad + i * (barW + gap);

  const gridVals = [0, 25, 50, 75, 100];

  // La línea de la semana anterior solo se dibuja donde HAY dato previo. Unir dos puntos
  // salteándose una sucursal sin dato anterior inventaría una pendiente que nadie midió.
  const previos = orden.map((d, i) =>
    esNumero(d.scorePrevio) ? { x: xOf(i) + barW / 2, y: yOf(d.scorePrevio), v: Number(d.scorePrevio) } : null
  );
  const tramos = [];
  let actual = [];
  for (const p of previos) {
    if (p) actual.push(p);
    else if (actual.length) { tramos.push(actual); actual = []; }
  }
  if (actual.length) tramos.push(actual);

  return (
    <div className="dashboard-bar-chart-wrap">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="dashboard-bar-chart mc-weekly-chart"
        style={{ height }}
        preserveAspectRatio="xMinYMid meet"
        role="img"
        aria-label={`Pulse Score por sucursal en la semana ${semanaLabel}`}
      >
        {/* Rejilla SOLO horizontal y sin línea de eje: las verticales no aportan nada cuando el
            eje X son categorías, y con 26 barras convierten el fondo en una reja. */}
        {gridVals.map((g) => (
          <g key={g}>
            <line
              x1={leftPad - 8} y1={yOf(g)} x2={w - rightPad} y2={yOf(g)}
              stroke="var(--mc-gris-suave)" strokeWidth="1"
            />
            <text x={leftPad - 14} y={yOf(g) + 3} textAnchor="end" fontSize="10" fill="var(--mc-texto-secundario)">
              {g}
            </text>
          </g>
        ))}

        <text
          x={12} y={topPad + chartH / 2}
          textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--mc-texto-secundario)"
          transform={`rotate(-90 12 ${topPad + chartH / 2})`}
        >
          Pulse Score
        </text>

        {orden.map((d, i) => {
          const v = Number(d.score);
          const nivel = getPulseStatus(v).nivel;
          const color = nivelColor(nivel);
          const x = xOf(i);
          const y = yOf(v);
          const alto = Math.max(2, topPad + chartH - y); // 2px mínimos: un 0 tiene que verse
          const previo = esNumero(d.scorePrevio) ? Number(d.scorePrevio) : null;
          const delta = previo === null ? null : v - previo;

          return (
            <g key={d.sucursal}>
              <rect x={x} y={y} width={barW} height={alto} rx="4" fill={color}>
                <title>
                  {`${d.sucursal} · ${semanaLabel}: ${v}`}
                  {previo !== null ? ` · ${semanaPreviaLabel || "semana anterior"}: ${previo} (${delta >= 0 ? "+" : ""}${delta})` : ""}
                  {d.respuestas ? ` · ${d.respuestas} respuesta${d.respuestas === 1 ? "" : "s"}` : ""}
                </title>
              </rect>
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
                {v}
              </text>
              {/* Girado 45°: 26 nombres no caben en horizontal, y truncarlos deja "McDental
                  Tam…" repetido cinco veces sin poder distinguirlos. */}
              <text
                x={x + barW / 2} y={height - bottomPad + 16}
                textAnchor="end" fontSize="10" fill="var(--mc-texto-secundario)"
                transform={`rotate(-45 ${x + barW / 2} ${height - bottomPad + 16})`}
              >
                {nombreCorto(d.sucursal)}
              </text>
            </g>
          );
        })}

        {tramos.map((tramo, i) =>
          // Un tramo de UN solo punto (la sucursal tiene dato previo pero sus vecinas no) no se
          // ve como polilínea: no hay segmento que trazar y el dato desaparece en silencio. Se
          // dibuja como punto para que ese "veníamos de 83" siga estando.
          tramo.length === 1 ? (
            <circle
              key={i}
              cx={tramo[0].x} cy={tramo[0].y} r="2.5"
              fill="var(--mc-texto-secundario)" opacity="0.75"
            />
          ) : (
            <polyline
              key={i}
              points={tramo.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--mc-texto-secundario)"
              strokeWidth="2"
              strokeDasharray="0.1 7"
              strokeLinecap="round"
              opacity="0.75"
            />
          )
        )}
      </svg>
    </div>
  );
};

export default WeeklyScoreChart;
