import { useState, useEffect, useCallback } from "react";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import { getEstadoDelSistema } from "../../services/supabase/estadoSistemaService";

/**
 * «¿Está todo bien?», respondido de un vistazo.
 *
 * Nace de un caso concreto: el respaldo externo llevaba seis días sin funcionar, el vigilante
 * lo detectó y avisó cada día, y el admin leyó los avisos. El respaldo seguía roto. La campana
 * enseña lo que PASÓ, y con 1.178 notificaciones acumuladas un aviso de verdad se pierde entre
 * los recordatorios de encuesta.
 *
 * Esto enseña lo que ESTÁ pasando. No hay nada que marcar como leído: cuando el respaldo
 * vuelva, la fila se pone verde sola. Es la diferencia entre «me enteré» y «ya está resuelto».
 */
const ORDEN_GRAVEDAD = { critico: 0, atencion: 1, sin_datos: 2, ok: 3 };

const PINTA = {
  critico:   { icono: "critical", texto: "Crítico" },
  atencion:  { icono: "warning",  texto: "Atención" },
  ok:        { icono: "check",    texto: "Bien" },
  sin_datos: { icono: "clock",    texto: "Sin datos" },
};

const EstadoSistema = () => {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Lo que está mal, ARRIBA. Ordenar por gravedad y no por el orden en que se calculan es la
  // mitad del valor de esta tarjeta: lo urgente no puede quedar a mitad de una lista.
  const porGravedad = (datos) =>
    [...datos].sort((a, b) => (ORDEN_GRAVEDAD[a.estado] ?? 9) - (ORDEN_GRAVEDAD[b.estado] ?? 9));

  // La carga inicial NO toca el estado antes del primer `await`: hacerlo dentro del efecto
  // encadena renders y el linter lo marca. `cargando` ya arranca en true.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const datos = await getEstadoDelSistema();
        if (!vivo) return;
        setFilas(porGravedad(datos));
        setError(null);
      } catch (e) {
        if (vivo) setError(e.message || "No se pudo consultar el estado.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // Este sí puede marcar "comprobando" de entrada: sale de un clic, no de un render.
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setFilas(porGravedad(await getEstadoDelSistema()));
      setError(null);
    } catch (e) {
      setError(e.message || "No se pudo consultar el estado.");
    } finally {
      setCargando(false);
    }
  }, []);

  const problemas = (filas || []).filter((f) => f.estado === "critico" || f.estado === "atencion");

  return (
    <Card className="config-panel">
      <div className="estado-sistema-head">
        <SectionTitle icon="shield">Estado del sistema</SectionTitle>
        <button type="button" className="mc-btn-outline mc-btn-with-icon" onClick={cargar} disabled={cargando}>
          <Icon name="refresh" size={15} /> {cargando ? "Comprobando…" : "Comprobar"}
        </button>
      </div>

      <p className="mc-hint">
        <Icon name="alert" size={15} />
        Esto no son avisos, es el estado de ahora mismo. Si algo se arregla, se pone en verde
        solo — no hay que marcar nada como leído.
      </p>

      {error && (
        <div className="mc-empty mc-empty--error">{error}</div>
      )}

      {!error && filas && (
        <>
          <div className={`estado-sistema-resumen estado-sistema-resumen--${problemas.length ? "mal" : "bien"}`}>
            <Icon name={problemas.length ? "warning" : "check"} size={18} />
            {problemas.length === 0
              ? "Todo en orden."
              : `${problemas.length} ${problemas.length === 1 ? "cosa necesita" : "cosas necesitan"} atención.`}
          </div>

          <div className="estado-sistema-lista">
            {filas.map((f) => {
              const p = PINTA[f.estado] || PINTA.sin_datos;
              return (
                <div key={f.clave} className={`estado-sistema-fila estado-sistema-fila--${f.estado}`}>
                  <span className="estado-sistema-punto"><Icon name={p.icono} size={16} /></span>
                  <span className="estado-sistema-texto">
                    <span className="estado-sistema-titulo">{f.titulo}</span>
                    <span className="estado-sistema-detalle">{f.detalle}</span>
                  </span>
                  <span className="estado-sistema-etiqueta">{p.texto}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!error && !filas && cargando && (
        <div className="mc-empty">Comprobando…</div>
      )}
    </Card>
  );
};

export default EstadoSistema;
