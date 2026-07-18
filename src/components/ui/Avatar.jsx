import React from "react";
import { nivelColor, colorMarca } from "../../config/theme";

const getInitials = (name) =>
  name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "";

/**
 * Acepta `slug` (un nivel de semáforo) igual que el resto de componentes, para que todos
 * hablen el mismo idioma. `color` sigue existiendo para los casos que NO son semáforo (el
 * avatar de la barra lateral, el del perfil), pero debe ser una variable CSS, no un hex:
 * ver DESIGN.md.
 */
const Avatar = ({ name, size = 36, slug, color, photoUrl }) => {
  const fondo = slug ? nivelColor(slug) : (color || colorMarca);

  return (
    <div
      className="mc-avatar"
      style={{
        width: size,
        height: size,
        background: photoUrl ? undefined : fondo,
        fontSize: size * 0.35,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {photoUrl
        ? <img src={photoUrl} alt={name || "Avatar"} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : getInitials(name)}
    </div>
  );
};

export default Avatar;
