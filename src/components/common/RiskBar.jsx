import React from "react";
import { nivelColor } from "../../config/theme";

/**
 * `color` era un hex que llegaba desde el componente padre. Ahora se pasa el `slug` del
 * nivel y el color sale de una variable CSS, que cambia con el tema.
 *
 * El resto de estilos inline se quedan: son de layout (alto, ancho, radio, transición), no
 * de color, así que no rompen el modo oscuro. El `width: ${value}%` es dinámico por
 * naturaleza y no puede vivir en una clase.
 */
const RiskBar = ({ label, value, slug = "sin-datos" }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
      <span className="mc-riskbar-label" style={{ color: "var(--mc-texto-secundario)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: nivelColor(slug), fontWeight: 700 }}>{value}%</span>
    </div>
    <div className="mc-riskbar-track" style={{ height: 8, background: "var(--mc-riskbar-track)", borderRadius: 99 }}>
      <div
        style={{
          height: "100%",
          width: `${value}%`,
          background: nivelColor(slug),
          borderRadius: 99,
          transition: "width .5s",
        }}
      />
    </div>
  </div>
);

export default RiskBar;
