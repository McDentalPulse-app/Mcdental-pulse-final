import Icon from "./Icon";
import { getMedalla } from "../../config/medallas";

// Medalla de reconocimiento: listón + medallón, dibujada como SVG INLINE (la CSP bloquea assets
// externos, así que nada de CDN). El arte sigue el patrón de los sets de premios abiertos sin
// atribución (CC0 — estilo svgrepo/uxwing "achievement medal"). El color y el emblema del centro
// salen de config/medallas.js, así cada categoría tiene su propia medalla sin código a medida.
export default function Medalla({ categoria, size = 56, className = "" }) {
  const { icono, color } = getMedalla(categoria);
  const totalH = size * 1.14;
  const emblema = Math.round(size * 0.3);

  return (
    <span
      className={`mc-medalla${className ? ` ${className}` : ""}`}
      style={{ position: "relative", display: "inline-flex", width: size, height: totalH, flex: "none" }}
    >
      <svg width={size} height={totalH} viewBox="0 0 50 57" fill="none" aria-hidden="true">
        {/* Listones de cinta que cuelgan del medallón */}
        <path d="M16 1 L26 27 L15 31 Z" fill={color} opacity="0.85" />
        <path d="M34 1 L24 27 L35 31 Z" fill={color} opacity="0.6" />
        {/* Medallón: aro exterior de color + disco claro + tinte suave para el contraste del emblema */}
        <circle cx="25" cy="38" r="17" fill={color} />
        <circle cx="25" cy="38" r="16.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
        <circle cx="25" cy="38" r="13" fill="#fff" />
        <circle cx="25" cy="38" r="13" fill={color} opacity="0.12" />
      </svg>

      {/* Emblema de la categoría, centrado sobre el disco del medallón */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: Math.round(size * 0.5 - emblema / 2),
          top: Math.round(totalH * 0.6667 - emblema / 2),
          width: emblema,
          height: emblema,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
        }}
      >
        <Icon name={icono} size={emblema} />
      </span>
    </span>
  );
}
