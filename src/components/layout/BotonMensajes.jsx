import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobal } from "../../contexts/GlobalContext";
import { navItemsPara, rutaBaseDe } from "../../config/navItems";
import Icon from "../ui/Icon";

/**
 * Acceso permanente a Mensajes, con el contador de no leídos.
 *
 * UN SOLO COMPONENTE para las navegaciones que lo muestran —el header de escritorio, el tab fijo
 * de la barra inferior del teléfono (roles con checador) y el flotante de admin/admin_plus, que
 * no tienen esa barra— porque son sitios distintos que muestran lo MISMO. Tener el contador
 * escrito dos veces es exactamente cómo el móvil se quedó atrás la primera vez.
 *
 * `variante` solo cambia dónde se coloca y el tamaño; el contenido y la cuenta son idénticos.
 */
export default function BotonMensajes({ variante = "header", activo = false }) {
  const { user } = useAuth();
  const { mensajes, modulosRol } = useGlobal();
  const navigate = useNavigate();

  // Se pregunta al menú del rol en vez de asumir que todos lo tienen: si algún día un rol se queda
  // sin Mensajes, el botón desaparece con él y no hay que acordarse de este archivo.
  if (!navItemsPara(user, modulosRol).some((i) => i.key === "mensajes")) return null;

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
  const esTab = variante === "tab";

  if (esTab) {
    // Mismo marcado que un .mobile-tab normal (Sidebar.jsx) para no desentonar con sus vecinos;
    // el badge de no leídos va sobre el ícono, como el punto de BotonReuniones en su versión tab.
    return (
      <button
        type="button"
        className={`mobile-tab${activo ? " mobile-tab--active" : ""}`}
        onClick={() => navigate(`/${rutaBaseDe(user.role)}/mensajes`)}
        aria-current={activo ? "page" : undefined}
        aria-label={noLeidos ? `Mensajes, ${noLeidos} sin leer` : "Mensajes"}
      >
        <span className={`mobile-tab-ico${activo ? " mobile-tab-ico--active" : ""}`}>
          <Icon name="message" size={20} />
          {noLeidos > 0 && (
            <span className="mobile-tab-badge" aria-hidden="true">{noLeidos > 9 ? "9+" : noLeidos}</span>
          )}
        </span>
        <span className="mobile-tab-label">Mensajes</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={
        esFlotante
          ? "mensajes-flotante"
          : `topnav-mensajes${activo ? " topnav-mensajes--activo" : ""}`
      }
      onClick={() => navigate(`/${rutaBaseDe(user.role)}/mensajes`)}
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
