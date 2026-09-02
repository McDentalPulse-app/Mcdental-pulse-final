import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobal } from "../../contexts/GlobalContext";
import { navItemsPara, rutaBaseDe } from "../../config/navItems";
import { estadoParaElIcono } from "../../utils/reuniones";
import Icon from "../ui/Icon";

/**
 * Acceso permanente a Reuniones, con el indicador de si hay una.
 *
 * Gemelo de BotonMensajes: UN SOLO COMPONENTE para el header de escritorio y el flotante del
 * teléfono, por el mismo motivo que allí — dos sitios que muestran lo MISMO. `variante` solo
 * cambia dónde se coloca y el tamaño.
 *
 * DOS NIVELES, no uno:
 *   · en curso  → punto que pulsa. Hay una sala abierta AHORA y se puede entrar.
 *   · hoy       → punto suave. Hay una más tarde, hoy.
 *   · nada      → sin punto.
 *
 * La regla de «en curso» NO se decide aquí: viene de utils/reuniones.js, que es el mismo módulo
 * que usa la lista para habilitar el botón «Entrar». Escrita dos veces, el día que alguien
 * cambiara la ventana el icono pulsaría cuando ya no se puede entrar — o peor, se quedaría
 * apagado con la reunión abierta.
 */
export default function BotonReuniones({ variante = "header", activo = false }) {
  const { user } = useAuth();
  const { reuniones, modulosRol } = useGlobal();
  const navigate = useNavigate();

  // El "ahora" avanza solo: sin esto, el punto no se encendería al llegar la hora hasta que
  // alguien recargara la página — justo cuando hay que entrar. Mismo intervalo que la lista.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Se pregunta al menú del rol en vez de asumir que todos lo tienen, igual que BotonMensajes:
  // si algún día un rol se queda sin Reuniones, el botón desaparece con él.
  if (!navItemsPara(user, modulosRol).some((i) => i.key === "reuniones")) return null;

  const estado = estadoParaElIcono(reuniones, ahora);
  const esFlotante = variante === "flotante";
  const base = esFlotante ? "reuniones-flotante" : "topnav-reuniones";

  const etiqueta =
    estado === "en_curso" ? "Reuniones, hay una en curso"
      : estado === "hoy" ? "Reuniones, tienes una hoy"
        : "Reuniones";

  return (
    <button
      type="button"
      className={`${base}${activo && !esFlotante ? " topnav-reuniones--activo" : ""}`}
      onClick={() => navigate(`/${rutaBaseDe(user.role)}/reuniones`)}
      title={etiqueta}
      aria-label={etiqueta}
    >
      <Icon name="camera" size={esFlotante ? 20 : 19} />
      {estado && (
        <span
          className={`${base}-punto${estado === "en_curso" ? ` ${base}-punto--encurso` : ""}`}
          // El punto es decorativo: lo que dice se lo lleva el aria-label del botón, así que
          // anunciarlo dos veces solo estorba a quien usa lector de pantalla.
          aria-hidden="true"
        />
      )}
    </button>
  );
}
