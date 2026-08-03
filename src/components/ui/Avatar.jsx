import React, { useRef, useState } from "react";
import { nivelColor, colorMarca } from "../../config/theme";
// El visor vive ahora en su propio archivo: el chat necesitaba el mismo.
import FotoAmpliada from "./FotoAmpliada";

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
/**
 * `zoom` (activo por defecto): si hay foto, se puede picar el avatar para verla en grande.
 * Se apaga con `zoom={false}` donde el avatar ya vive DENTRO de un botón — un botón dentro de
 * otro es HTML inválido y le robaría el clic al control que lo contiene (el menú de usuario,
 * elegir conversación en Mensajes, los chips de la IA). Sin foto no hay nada que ampliar: las
 * iniciales nunca son pulsables.
 */
const Avatar = ({ name, size = 36, slug, color, photoUrl, presente, zoom = true }) => {
  const fondo = slug ? nivelColor(slug) : (color || colorMarca);
  const [ampliada, setAmpliada] = useState(false);
  const disparadorRef = useRef(null);
  const ampliable = zoom && Boolean(photoUrl);

  const cerrar = () => {
    setAmpliada(false);
    // Devolver el foco a la foto que se picó: si no, el teclado vuelve al principio del
    // documento y quien navega sin ratón pierde el sitio en una lista de 100 empleados.
    disparadorRef.current?.focus();
  };

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

  const nucleo = ampliable ? (
    <button
      type="button"
      ref={disparadorRef}
      className="mc-avatar-zoom"
      style={{ width: size, height: size }}
      // La fila de la tabla y la tarjeta del empleado también responden al clic. Sin frenarlo
      // aquí, picar la foto abriría la ficha en lugar de la foto.
      onClick={(e) => { e.stopPropagation(); setAmpliada(true); }}
      title="Ver la foto en grande"
      aria-label={name ? `Ver la foto de ${name} en grande` : "Ver la foto en grande"}
    >
      {cara}
    </button>
  ) : cara;

  const visible = presente === undefined ? nucleo : (
    <span className="mc-avatar-wrap" style={{ width: size, height: size }}>
      {nucleo}
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

  if (!ampliable) return visible;

  return (
    <>
      {visible}
      {ampliada && (
        <FotoAmpliada
          src={photoUrl}
          alt={name ? `Foto de ${name}` : "Foto de perfil"}
          pie={name}
          onClose={cerrar}
        />
      )}
    </>
  );
};

export default Avatar;
