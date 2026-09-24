import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import WeekSelect from "../common/WeekSelect";
import AcuerdoConformidad from "./AcuerdoConformidad";
import { useEscapeKey } from "../../hooks/useEscapeKey";

/**
 * Paso previo a imprimir o descargar el acuerdo de UNA persona: deja elegir de qué semana —
 * la activa en pantalla u otra anterior — antes de generar el papel, y muestra la vista previa
 * con el MISMO diseño del recibo que sale impreso (AcuerdoConformidad, en modo `editable`), no
 * un resumen aparte. Cambiar la semana vuelve a calcular el recibo de cero (checadas, retardos
 * y faltas de ESA semana), así el acuerdo siempre refleja los descuentos reales del periodo
 * elegido y no los de la semana que estaba activa en la pantalla de Nómina.
 */
export default function SeleccionarSemanaAcuerdoModal({ empleado, opcionesSemana, semanaInicial, onCalcular, onImprimir, onDescargar, onCerrar }) {
  const [semana, setSemana] = useState(semanaInicial);
  const [datos, setDatos] = useState(null); // { recibo, desde, hasta } | null
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEscapeKey(onCerrar, true);

  // El spinner se enciende en `elegirSemana` (el evento del WeekSelect), no aquí de forma
  // síncrona dentro del efecto — mismo patrón que `cargar`/`cambiarSemana` en Nomina.jsx, para
  // no disparar un render en cascada (react-hooks/set-state-in-effect). Al montar el modal
  // `cargando` ya arranca en `true` por su estado inicial, así que la primera carga no lo necesita.
  useEffect(() => {
    let cancelado = false;
    onCalcular(empleado, semana)
      .then((r) => { if (!cancelado) { setDatos(r); setError(null); } })
      .catch((e) => {
        if (cancelado) return;
        console.error("Error calculando el acuerdo de esa semana:", e);
        setError(e?.message || "No se pudo calcular el acuerdo de esa semana.");
      })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [empleado, semana, onCalcular]);

  const elegirSemana = (valor) => {
    setCargando(true);
    setSemana(valor);
  };

  const listo = !cargando && !error && datos;

  return (
    <div className="mc-modal-overlay" onClick={onCerrar} role="presentation">
      <div
        className="mc-modal nomina-acuerdo-semana-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="acuerdo-semana-modal-titulo"
      >
        <h2 id="acuerdo-semana-modal-titulo" className="mc-modal-title mc-btn-with-icon">
          <Icon name="printer" size={20} /> Acuerdo de pago — {empleado.name}
        </h2>

        <div className="mc-form-group">
          <label className="mc-form-label">Semana a imprimir</label>
          <WeekSelect value={semana} options={opcionesSemana} onChange={elegirSemana} />
        </div>

        <div className="nomina-acuerdo-semana-preview">
          {cargando ? (
            <p className="mc-empty">Calculando el acuerdo de esa semana…</p>
          ) : error ? (
            <p className="mc-empty"><Icon name="alert" size={16} /> {error}</p>
          ) : (
            <AcuerdoConformidad acuerdos={[{ empleado, recibo: datos.recibo }]} desde={datos.desde} hasta={datos.hasta} editable />
          )}
        </div>

        <div className="mc-form-actions">
          <button type="button" className="mc-btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="mc-btn-outline mc-btn-with-icon"
            disabled={!listo}
            onClick={() => onDescargar(empleado, datos.recibo, datos.desde, datos.hasta)}
          >
            <Icon name="fileDownload" size={16} /> Descargar
          </button>
          <button
            type="button"
            className="mc-btn-primary mc-btn-with-icon"
            disabled={!listo}
            onClick={() => onImprimir(empleado, datos.recibo, datos.desde, datos.hasta)}
          >
            <Icon name="printer" size={16} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
