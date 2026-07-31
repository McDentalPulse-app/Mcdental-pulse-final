import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobal } from "../../contexts/GlobalContext";
import { navItemsPara } from "../../config/navItems";
import Icon from "../ui/Icon";

/**
 * Acceso permanente a Mensajes, con el contador de no leídos.
 *
 * UN SOLO COMPONENTE para las dos navegaciones —el header de escritorio y el flotante del
 * teléfono— porque son dos sitios distintos que muestran lo MISMO. Tener el contador escrito dos
 * veces es exactamente cómo el móvil se quedó atrás la primera vez.
 *
 * `variante` solo cambia dónde se coloca y el tamaño; el contenido y la cuenta son idénticos.
 */
export default function BotonMensajes({ variante = "header", activo = false }) {
  const { user } = useAuth();
  const { mensajes } = useGlobal();
  const navigate = useNavigate();

  // Se pregunta al menú del rol en vez de asumir que todos lo tienen: si algún día un rol se queda
  // sin Mensajes, el botón desaparece con él y no hay que acordarse de este archivo.
  if (!navItemsPara(user).some((i) => i.key === "mensajes")) return null;

  // Admin y RH no ven el chat (Mensajes les abre Reuniones): contarles "no leídos" señalaría una
  // conversación que no pueden atender.
  const veChat = ["psicologa", "empleado", "doctor"].includes(user?.role);
  const noLeidos = veChat
    ? (mensajes || []).filter((m) => m.para === user?.id && !m.leido && !m.eliminado).length
    : 0;

  const esFlotante = variante === "flotante";

  return (
    <button
      type="button"
      className={
        esFlotante
          ? "mensajes-flotante"
          : `topnav-mensajes${activo ? " topnav-mensajes--activo" : ""}`
      }
      onClick={() => navigate(`/${user.role}/mensajes`)}
      title="Mensajes"
      aria-label={noLeidos ? `Mensajes, ${noLeidos} sin leer` : "Mensajes"}
    >
      <Icon name="message" size={esFlotante ? 20 : 19} />
      {noLeidos > 0 && (
        <span className={esFlotante ? "mensajes-flotante-badge" : "topnav-mensajes-badge"}>
          {noLeidos > 9 ? "9+" : noLeidos}
        </span>
      )}
    </button>
  );
}
