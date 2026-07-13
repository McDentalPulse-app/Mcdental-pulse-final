import React from "react";
import Card from "./Card";
import { colorMarca, nivelColor } from "../../config/theme";
import Icon from "../ui/Icon";

/**
 * `color` era un hex: por defecto `UI.verdeMedio`, que valía #00796B — el verde de un
 * diseño anterior. La marca real es #0E8C7A, así que los KPIs llevaban tiempo pintándose
 * con un verde que ya no existía. Y al ser un hex en JS, tampoco tenían modo oscuro.
 *
 * Ahora se le pasa `slug` (un nivel de semáforo) o nada, y el color sale de una variable
 * CSS que cambia con el tema. Los `color-mix()` ya estaban bien: aceptan variables.
 */
const KPI = ({ label, value, sub, slug, iconName }) => {
  const color = slug ? nivelColor(slug) : colorMarca;

  return (
    <Card className="mc-kpi">
      <div className="mc-kpi-glow" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }} />
      {iconName && (
        <div className="mc-kpi-icon" style={{ background: `color-mix(in srgb, ${color} 7%, transparent)`, color }}>
          <Icon name={iconName} size={20} />
        </div>
      )}
      <div className="mc-kpi-value" style={{ color }}>{value}</div>
      <div className="mc-kpi-label">{label}</div>
      {sub && <div className="mc-kpi-sub">{sub}</div>}
    </Card>
  );
};

export default KPI;
