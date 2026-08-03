import { lazy, Suspense, useMemo, useState } from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import WeekSelect from "../common/WeekSelect";
import EmptyState from "../common/EmptyState";

/**
 * La gráfica se carga aparte, y no es una optimización de manual: arrastra recharts, que son
 * ~360 KB. Sin el import diferido, esos kilobytes entran en el mismo paquete que la cabecera y
 * los KPIs, así que la pantalla entera espera a la librería de gráficas para pintar el primer
 * número — en un móvil de la clínica, con datos, eso se nota. Así se ven antes los KPIs y la
 * gráfica llega cuando llega.
 */
const WeeklyScoreChart = lazy(() => import("../common/WeeklyScoreChart"));
import { normalizeSucursal, formatSemanaDisplay } from "../../utils/constants";
import { nivelColor } from "../../config/theme";

/**
 * "Tendencia del bienestar por oficina", en UNA semana a la vez.
 *
 * Vive aquí y no dentro de cada dashboard porque los tres —admin, RH y psicóloga— enseñaban lo
 * mismo con el código duplicado, y al duplicarlo se les fue separando: cualquier arreglo había
 * que acordarse de hacerlo dos veces. Ahora es un solo bloque con su propio selector de semana,
 * independiente del selector de la cabecera (ahí se elige el periodo de los KPIs; aquí, el de
 * la gráfica, y no tienen por qué ser el mismo).
 */
const LEYENDA = [
  { nivel: "verde", texto: "Estable (80 o más)" },
  { nivel: "amarillo", texto: "Atención (60 a 79)" },
  { nivel: "rojo", texto: "Crítico (menos de 60)" },
];

const TendenciaBienestar = ({ encuestas = [], usuarios = [] }) => {
  // Sucursal de cada empleado, para poder agrupar sus encuestas.
  const sucursalDe = useMemo(() => {
    const m = new Map();
    usuarios.forEach((u) => m.set(u.id, normalizeSucursal(u.sucursal) || "Sin sucursal"));
    return m;
  }, [usuarios]);

  // semana -> sucursal -> [scores]
  const porSemana = useMemo(() => {
    const m = new Map();
    for (const e of encuestas) {
      const score = Number(e.score);
      if (!Number.isFinite(score)) continue;
      const suc = sucursalDe.get(e.empleadoId);
      if (!suc) continue;
      const semana = formatSemanaDisplay(String(e.semana));
      if (!m.has(semana)) m.set(semana, new Map());
      const porSuc = m.get(semana);
      if (!porSuc.has(suc)) porSuc.set(suc, []);
      porSuc.get(suc).push(score);
    }
    return m;
  }, [encuestas, sucursalDe]);

  // Solo las semanas que TIENEN datos: ofrecer una semana vacía es hacer perder el tiempo.
  const semanas = useMemo(() => [...porSemana.keys()].sort((a, b) => a.localeCompare(b)), [porSemana]);

  const [semanaSel, setSemanaSel] = useState(null);
  const semana = semanaSel && porSemana.has(semanaSel) ? semanaSel : semanas[semanas.length - 1];

  const previa = useMemo(() => {
    const i = semanas.indexOf(semana);
    return i > 0 ? semanas[i - 1] : null;
  }, [semanas, semana]);

  const datos = useMemo(() => {
    const actual = porSemana.get(semana);
    if (!actual) return [];
    const anterior = previa ? porSemana.get(previa) : null;
    const promedio = (arr) => (arr?.length ? Math.round(arr.reduce((a, c) => a + c, 0) / arr.length) : null);

    return [...actual.entries()].map(([sucursal, scores]) => ({
      sucursal,
      score: promedio(scores),
      respuestas: scores.length,
      scorePrevio: promedio(anterior?.get(sucursal)),
    }));
  }, [porSemana, semana, previa]);

  return (
    <Card>
      <div className="tendencia-head">
        <SectionTitle icon="trending">Tendencia del bienestar por oficina</SectionTitle>
        {semanas.length > 1 && (
          <WeekSelect
            value={semana}
            onChange={setSemanaSel}
            options={semanas
              .slice()
              .reverse()
              .map((s, i) => ({ value: s, label: i === 0 ? `${s} · más reciente` : s }))}
          />
        )}
      </div>

      {!datos.length ? (
        <EmptyState icon="trending" message="Todavía no hay encuestas contestadas para esta semana." />
      ) : (
        <>
          {/* El hueco reserva la MISMA altura que la gráfica: sin eso, al llegar recharts la
              leyenda y el pie saltan hacia abajo delante de quien esté leyéndolos. */}
          <Suspense fallback={<div className="mc-chart-cargando" style={{ height: 300 }} />}>
            <WeeklyScoreChart
              datos={datos}
              semanaLabel={semana}
              semanaPreviaLabel={previa}
              height={300}
            />
          </Suspense>

          <div className="psico-trend-legend">
            {LEYENDA.map((l) => (
              <span key={l.nivel} className="psico-trend-legend-item">
                <span className="psico-trend-dot" style={{ background: nivelColor(l.nivel) }} />
                {l.texto}
              </span>
            ))}
            {previa && (
              <span className="psico-trend-legend-item">
                <span className="psico-trend-dash" />
                {`Semana anterior (${previa})`}
              </span>
            )}
          </div>

          <p className="psico-chart-foot">
            {`Pulse Score promedio por sucursal en ${semana} · ${datos.length} sucursale${datos.length === 1 ? "" : "s"} con respuestas.`}
          </p>
        </>
      )}
    </Card>
  );
};

export default TendenciaBienestar;
