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
/**
 * `presente` pinta el punto verde de "está aquí". Es opcional y solo lo usa el chat: sin él,
 * el avatar se devuelve tal cual y ninguna de las pantallas que ya lo usan cambia de aspecto.
 *
 * Cuidado con lo que significa: en el chat el punto viene de la presencia de ESA conversación,
 * es decir "tiene esta conversación abierta", no "está conectado a la app". Pintarlo con
 * cualquier otro criterio le diría al empleado que la psicóloga está disponible cuando puede
 * no estarlo.
 */
const Avatar = ({ name, size = 36, slug, color, photoUrl, presente }) => {
  const fondo = slug ? nivelColor(slug) : (color || colorMarca);

  const cara = (
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

  if (presente === undefined) return cara;

  return (
    <span className="mc-avatar-wrap" style={{ width: size, height: size }}>
      {cara}
      {presente && (
        // El punto escala con el avatar: a 10px fijos se come el de 24 y se pierde en el de 56.
        <span
          className="mc-avatar-presente"
          style={{ width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }}
          title="Tiene esta conversación abierta"
        />
      )}
    </span>
  );
};

export default Avatar;
