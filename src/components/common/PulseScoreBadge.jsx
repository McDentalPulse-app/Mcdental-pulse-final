import React from "react";
import { nivelColor, nivelTinte } from "../../config/theme";

/**
 * Antes recibía `color` (un hex) y componía el fondo con `${color}14`: concatenar el alpha
 * al final del hex. Eso SOLO funciona con hex, y por eso este badge no tenía modo oscuro.
 *
 * Ahora recibe `slug` (verde | amarillo | rojo | sin-datos) y el color sale de una variable
 * CSS que el navegador resuelve según el tema. El tinte se hace con color-mix(), que sí
 * acepta variables. Los porcentajes son los mismos de antes: 0x14 ≈ 8%, 0x35 ≈ 21%.
 */
const PulseScoreBadge = ({ score, nivel, slug = "sin-datos", tendencia, size = "md" }) => {
  const sizeClass = size === "lg" ? "mc-pulse-badge--lg" : size === "sm" ? "mc-pulse-badge--sm" : "";
  const displayScore = score == null ? "—" : score;
  const color = nivelColor(slug);

  return (
    <div
      className={`mc-pulse-badge ${sizeClass}`.trim()}
      style={{ background: nivelTinte(slug, 8), borderColor: nivelTinte(slug, 21) }}
    >
      <div
        className="mc-pulse-badge-score"
        style={{ color, fontSize: size === "lg" ? 36 : size === "sm" ? 18 : 24 }}
      >
        {displayScore}
      </div>
      <div>
        <div className="mc-pulse-badge-label" style={{ color }}>Pulse Score™</div>
        <div className="mc-pulse-badge-meta">{nivel} {tendencia}</div>
      </div>
    </div>
  );
};

export default PulseScoreBadge;
