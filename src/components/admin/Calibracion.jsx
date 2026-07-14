import { useEffect, useMemo, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { useNotification } from "../../contexts/NotificationContext";
import {
  getScoresChecadas,
  getIntentosFallidos,
  getParecidos,
} from "../../services/supabase/calibracionService";
import {
  UMBRAL_ACTUAL,
  margenPorEmpleado,
  masCercaDeColarse,
  curvaDeCoste,
  intentosPorEmpleado,
  histograma,
  parecidosPeligrosos,
} from "../../utils/calibracion";

/**
 * Calibración del cotejo facial.
 *
 * LO QUE ESTA PANTALLA SE NIEGA A HACER: darte un "umbral óptimo".
 *
 * La tentación es pintar las dos nubes de scores —los que pasaron y los que no—, ver el hueco y
 * poner el umbral en medio. Pero fue EL UMBRAL quien decidió en qué tabla cae cada número: los
 * que pasan van a `asistencias`, los que no, a `cotejo_intentos`. El hueco que se vería no es la
 * realidad: es el propio umbral mirándose al espejo. Un número sacado de ahí no sería una
 * medición, sería el que ya teníamos con un aire de autoridad que no se ha ganado. Y así fue
 * exactamente como el 0.363 de fábrica nos dejó pasar a un impostor por 0.003.
 *
 * Así que aquí no hay un número mágico. Hay tres preguntas que los datos SÍ pueden responder:
 *
 *   1. ¿Quién está a punto de no poder fichar? (su score mínimo, no el promedio)
 *   2. ¿Cuánto se acercó a colarse el que más cerca estuvo?
 *   3. Si subo el umbral, ¿a cuánta gente real dejo fuera?
 *
 * Y una que no pueden: si BAJARLO sería seguro. Debajo del umbral estamos ciegos, y la pantalla
 * lo dice en lugar de disimularlo con un gráfico bonito.
 */
export default function Calibracion({ usuarios = [] }) {
  const { toast } = useNotification();

  const [checadas, setChecadas] = useState([]);
  const [intentos, setIntentos] = useState([]);
  const [parecidos, setParecidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([getScoresChecadas(), getIntentosFallidos(), getParecidos()])
      .then(([c, i, p]) => {
        setChecadas(c);
        setIntentos(i);
        setParecidos(p);
      })
      .catch((e) => toast.error(e?.message || "No se pudieron cargar los datos del cotejo."))
      .finally(() => setCargando(false));
  }, [toast]);

  const nombre = useMemo(() => {
    const porId = new Map(usuarios.map((u) => [u.id, u.name]));
    return (id) => porId.get(id) || "Empleado dado de baja";
  }, [usuarios]);

  const margenes = useMemo(() => margenPorEmpleado(checadas), [checadas]);
  const justos = useMemo(() => margenes.filter((m) => m.justo), [margenes]);
  const masCerca = useMemo(() => masCercaDeColarse(intentos), [intentos]);
  const curva = useMemo(() => curvaDeCoste(checadas), [checadas]);
  const fallos = useMemo(() => intentosPorEmpleado(intentos), [intentos]);
  const riesgo = useMemo(() => parecidosPeligrosos(parecidos), [parecidos]);

  // Las dos nubes, en la misma escala, para que se vea DÓNDE está cada una — no para deducir el
  // umbral de ellas.
  const nubeAciertos = useMemo(
    () => histograma(checadas.map((c) => c.match_score), { cubos: 20 }),
    [checadas]
  );
  const nubeRechazos = useMemo(
    () => histograma(intentos.map((i) => i.score), { cubos: 20 }),
    [intentos]
  );
  const altura = useMemo(
    () => Math.max(1, ...nubeAciertos.map((b) => b.n), ...nubeRechazos.map((b) => b.n)),
    [nubeAciertos, nubeRechazos]
  );

  // Quien nunca ha pasado el cotejo pero acumula fallos NO es una víctima de un impostor: es
  // alguien a quien el sistema está rechazando a él, con su propia cara. Confundir los dos casos
  // es castigar a la víctima.
  const conChecadas = useMemo(
    () => new Set(margenes.map((m) => m.empleadoId)),
    [margenes]
  );

  if (cargando) {
    return (
      <>
        <PageHeader title="Calibración del cotejo" subtitle="Cargando los números…" />
      </>
    );
  }

  const sinDatos = checadas.length === 0 && intentos.length === 0;

  return (
    <>
      <PageHeader
        title="Calibración del cotejo"
        subtitle={`Umbral actual: ${UMBRAL_ACTUAL.toFixed(2)} · ${checadas.length} checadas verificadas · ${intentos.length} intentos rechazados`}
      />

      {sinDatos && (
        <Card>
          <p className="calib-vacio">
            Todavía no hay ni una checada con cotejo facial. Esta pantalla no dice nada hasta que
            la gente empiece a fichar: calibrar sin datos es exactamente el error que se intenta
            evitar aquí.
          </p>
        </Card>
      )}

      {!sinDatos && (
        <>
          {/* ---------- 1. Quién está a punto de quedarse fuera ---------- */}
          <Card>
            <SectionTitle
              title="Quién está a punto de no poder fichar"
              subtitle="El score MÍNIMO de cada quien, no el promedio: el promedio siempre sale bien y no avisa de nada"
            />

            {justos.length === 0 ? (
              <p className="calib-ok">
                <Icon name="check-circle" size={16} /> Nadie pasa raspando. Todo el mundo tiene al
                menos {(UMBRAL_ACTUAL + 0.1).toFixed(2)} de margen en su peor día.
              </p>
            ) : (
              <p className="calib-alerta">
                <Icon name="alert-triangle" size={16} />
                {justos.length === 1
                  ? " 1 persona está a un día de mala luz de quedarse plantada en la puerta. Rehazle las fotos ANTES de que pase, no cuando ya esté atascada en la entrada."
                  : ` ${justos.length} personas están a un día de mala luz de quedarse plantadas en la puerta. Rehazles las fotos ANTES de que pase, no cuando ya estén atascadas en la entrada.`}
              </p>
            )}

            <ul className="calib-lista">
              {margenes.slice(0, 12).map((m) => (
                <li key={m.empleadoId} className={m.justo ? "calib-lista-item--justo" : undefined}>
                  <span className="calib-nombre">{nombre(m.empleadoId)}</span>
                  <span className="calib-barra">
                    <span
                      className={`calib-barra-relleno ${m.justo ? "calib-barra-relleno--justo" : ""}`}
                      style={{ width: `${Math.min(100, m.minimo * 100)}%` }}
                    />
                  </span>
                  <span className="calib-num">
                    {m.minimo.toFixed(2)}
                    <em> · {m.n} {m.n === 1 ? "checada" : "checadas"}</em>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* ---------- 2. Lo más cerca que estuvo alguien de colarse ---------- */}
          <Card>
            <SectionTitle
              title="Lo más cerca que estuvo alguien de colarse"
              subtitle="Si este número sube hacia el umbral, alguien se está acercando"
            />

            {!masCerca ? (
              <p className="calib-ok">
                <Icon name="check-circle" size={16} /> Ningún intento rechazado en los últimos 30
                días.
              </p>
            ) : (
              <div className="calib-cerca">
                <strong className={masCerca.distancia < 0.08 ? "calib-cerca-num--alerta" : "calib-cerca-num"}>
                  {masCerca.score.toFixed(3)}
                </strong>
                <p>
                  Le faltaron <strong>{masCerca.distancia.toFixed(3)}</strong> para pasar por la
                  cuenta de <strong>{nombre(masCerca.empleadoId)}</strong>.{" "}
                  {masCerca.distancia < 0.08
                    ? "Está pegado al umbral. Vale la pena mirar quién es y qué pasó."
                    : "Hay aire de sobra: el umbral no está apretando."}
                </p>
              </div>
            )}
          </Card>

          {/* ---------- 3. Las dos nubes (con su advertencia) ---------- */}
          <Card>
            <SectionTitle
              title="Los dos grupos de scores"
              subtitle="Verdes: checadas que pasaron. Rojas: intentos rechazados"
            />

            <div className="calib-nube">
              {nubeAciertos.map((b, i) => (
                <span key={b.desde} className="calib-nube-col" title={`${b.desde.toFixed(2)}–${b.hasta.toFixed(2)}`}>
                  <span
                    className="calib-nube-barra calib-nube-barra--rechazo"
                    style={{ height: `${(nubeRechazos[i].n / altura) * 100}%` }}
                  />
                  <span
                    className="calib-nube-barra calib-nube-barra--acierto"
                    style={{ height: `${(b.n / altura) * 100}%` }}
                  />
                </span>
              ))}
              <span className="calib-nube-umbral" style={{ left: `${UMBRAL_ACTUAL * 100}%` }}>
                <em>{UMBRAL_ACTUAL.toFixed(2)}</em>
              </span>
            </div>

            <p className="calib-aviso">
              <Icon name="info" size={16} />
              <span>
                <strong>Ese hueco limpio en el medio no significa nada.</strong> Fue el propio
                umbral quien decidió a qué lado cae cada número: todo lo que pasa se guarda como
                checada y todo lo que no, como intento fallido. Las dos nubes están cortadas ahí
                por construcción, no porque la realidad las separe. Lo que sí se puede leer es{" "}
                <strong>dónde</strong> se acumula cada una: si los rechazos se amontonan lejos del
                umbral, hay aire; si se arriman, no.
              </span>
            </p>
          </Card>

          {/* ---------- 4. El precio de apretar ---------- */}
          <Card>
            <SectionTitle
              title="¿Y si subo el umbral?"
              subtitle="Esto sí se puede medir: son checadas de personas reales que ya ficharon"
            />

            <table className="calib-tabla">
              <thead>
                <tr>
                  <th>Umbral</th>
                  <th>Checadas que se habrían rechazado</th>
                  <th>Personas afectadas</th>
                </tr>
              </thead>
              <tbody>
                {curva.map((p) => (
                  <tr key={p.umbral} className={p.umbral === UMBRAL_ACTUAL ? "calib-fila--actual" : undefined}>
                    <td>
                      {p.umbral.toFixed(2)}
                      {p.umbral === UMBRAL_ACTUAL && <em> (actual)</em>}
                    </td>
                    <td>
                      {p.checadasRechazadas}
                      {p.checadasRechazadas > 0 && <em> ({p.porcentaje.toFixed(0)}%)</em>}
                    </td>
                    <td>{p.empleadosAfectados}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="calib-aviso">
              <Icon name="alert-triangle" size={16} />
              <span>
                <strong>Bajarlo no aparece en esta tabla, y no es un olvido.</strong> Por debajo
                del umbral estamos ciegos: ahí conviven las personas de verdad que fallaron por
                mala luz y los que intentaban colarse, y desde la base de datos no hay forma de
                saber quién estaba delante de la cámara. Subirlo se puede medir; bajarlo es una
                apuesta.
              </span>
            </p>
          </Card>

          {/* ---------- 5. Caras que se parecen demasiado ---------- */}
          {riesgo.length > 0 && (
            <Card>
              <SectionTitle
                title="Caras que el cotejo podría confundir"
                subtitle="El caso difícil nunca fue el desconocido, sino el parecido: un hermano, un primo"
              />
              <ul className="calib-lista">
                {riesgo.map((r) => (
                  <li key={r.empleado_id}>
                    <span className="calib-nombre">{nombre(r.empleado_id)}</span>
                    <span className="calib-parecido">
                      se parece a <strong>{nombre(r.parecido_con)}</strong>
                    </span>
                    <span className="calib-num">{r.parecido_maximo.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* ---------- 6. Fallos repetidos ---------- */}
          {fallos.length > 0 && (
            <Card>
              <SectionTitle
                title="Quién acumula intentos rechazados"
                subtitle="Un pico aquí tiene dos lecturas opuestas, y confundirlas es castigar a la víctima"
              />
              <ul className="calib-lista">
                {fallos.slice(0, 10).map((f) => {
                  const nuncaPasa = !conChecadas.has(f.empleadoId);
                  return (
                    <li key={f.empleadoId}>
                      <span className="calib-nombre">{nombre(f.empleadoId)}</span>
                      <span className={nuncaPasa ? "calib-parecido calib-parecido--alerta" : "calib-parecido"}>
                        {nuncaPasa
                          ? "nunca ha conseguido fichar — su cara de referencia es mala, no es un impostor"
                          : "también ficha con normalidad — alguien intentó pasar por él"}
                      </span>
                      <span className="calib-num">
                        {f.n} {f.n === 1 ? "fallo" : "fallos"}
                        <em> · máx {f.maximo.toFixed(2)}</em>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}
