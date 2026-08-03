import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import SectionTitle from "../common/SectionTitle";
import EmptyState from "../common/EmptyState";
import Badge from "../common/Badge";
import Icon from "../ui/Icon";
import { tieneScoreValido } from "../../utils/pulseScore";

/**
 * Las sucursales con más colaboradores en amarillo o rojo, y el detalle al pulsarlas.
 *
 * Vive aquí porque estaba DUPLICADO LITERAL entre el dashboard de admin y el de psicóloga —
 * la misma lista, el mismo modal, los mismos nombres de clase— con la única diferencia del
 * nombre de la variable de estado. Dos copias del mismo bloque son dos sitios donde arreglar
 * cada cosa, y en cuanto uno se olvida empiezan a divergir. Ahora es uno solo y RH lo estrena.
 */
const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};
const modalMotion = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.97 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
};

const SucursalesEnRiesgo = ({ sucursales = [], vacio = "Ninguna sucursal con casos en amarillo o rojo esta semana." }) => {
  const [detalle, setDetalle] = useState(null);

  return (
    <>
      <SectionTitle icon="alert">Sucursales en riesgo</SectionTitle>

      {!sucursales.length ? (
        <EmptyState icon="check" message={vacio} />
      ) : (
        <div className="psico-suc-list">
          {sucursales.map((s) => (
            <button
              key={s.suc}
              type="button"
              className="psico-suc-row psico-suc-row--clickable"
              title={`${s.riesgo} en riesgo: ${s.emps.map((e) => e.emp.name.split(" ")[0]).join(", ")}`}
              onClick={() => setDetalle(s)}
            >
              <div className="psico-suc-head">
                <span className="psico-suc-name">{s.suc}</span>
                <span className="psico-suc-count">
                  {s.riesgo}/{s.total} <Icon name="eye" size={13} />
                </span>
              </div>
              <div className="psico-suc-track">
                <div className="psico-suc-fill" style={{ width: `${Math.round((s.riesgo / s.total) * 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {detalle && (
          <motion.div className="mc-modal-overlay" onClick={() => setDetalle(null)} {...overlayMotion}>
            <motion.div
              className="mc-modal psico-suc-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="suc-riesgo-modal-title"
              {...modalMotion}
            >
              <div className="psico-suc-modal-head">
                <div>
                  <h2 id="suc-riesgo-modal-title" className="mc-modal-title">
                    <Icon name="building" size={18} /> {detalle.suc}
                  </h2>
                  <p className="admin-page-subtitle psico-suc-modal-sub">
                    {detalle.riesgo} de {detalle.total} colaboradores en riesgo
                  </p>
                </div>
                <button
                  type="button"
                  className="dashboard-sucursal-modal-close"
                  onClick={() => setDetalle(null)}
                  aria-label="Cerrar"
                >
                  <Icon name="xCircle" size={20} />
                </button>
              </div>
              <div className="psico-suc-modal-list">
                {detalle.emps.map(({ emp, score, nivel, tendencia }) => (
                  <div key={emp.id} className={`psico-suc-emp psico-suc-emp--${nivel}`}>
                    <div className="psico-suc-emp-info">
                      <div className="psico-suc-emp-name">{emp.name}</div>
                      <div className="psico-suc-emp-meta">{emp.puesto}</div>
                    </div>
                    <div className="psico-suc-emp-right">
                      <span className="psico-suc-emp-score">
                        Score {tieneScoreValido(score) ? score : "—"} {tendencia}
                      </span>
                      <Badge tipo={nivel} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SucursalesEnRiesgo;
