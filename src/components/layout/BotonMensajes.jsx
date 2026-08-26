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

  // Admin y RH no reciben cuenta de no leídos. OJO: el motivo original —que Mensajes les abría
  // Reuniones— ya no aplica; Reuniones tiene su propio icono y su propia ruta, y Mensajes.jsx
  // tiene veChat=true para todos, así que sí ven chat (el buzón de Soporte TI). Que no se les
  // cuenten los no leídos es hoy una decisión sin justificar, no una consecuencia. Pendiente de
  // decidir con el dueño; no se cambia aquí para no alterar de paso lo que ve gestión.
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
