import React from "react";
import { semaforoLabel } from "../../config/theme";

// Dos modos: `tipo` (semáforo verde/amarillo/rojo, como siempre) o `variant` +
// children (genérico, reusa los ~20 tonos de `.mc-status-pill--*` que ya
// existen repartidos en RH/Vacaciones/Permisos/Comisiones — antes cada
// pantalla escribía el <span> a mano).
const Badge = ({ tipo, variant, children }) => {
  if (variant) {
    return <span className={`mc-status-pill mc-status-pill--${variant}`}>{children}</span>;
  }
  return (
    <span className={`mc-badge mc-badge--${tipo || "default"}`}>
      <span className="mc-badge-dot" />
      {semaforoLabel[tipo] || tipo}
    </span>
  );
};

export default Badge;
