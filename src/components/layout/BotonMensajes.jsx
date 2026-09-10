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

  // DOS FALLOS ARREGLADOS ACÁ (mig. 155, al montar el buzón de Mantenimiento):
  //
  // 1. `m.para === user.id` NUNCA es cierto para un mensaje de buzón: entra sin destinatario
  //    (`para` nulo), que es justo como se le escribe a un buzón. O sea que un reporte a Soporte
  //    Sistemas no encendía el badge de nadie, y quien lo mandaba veía "enviado". Silencioso.
  // 2. Admin y RH estaban fuera del contador por un `veChat` que el propio comentario de antes
  //    reconocía como "una decisión sin justificar". Con Mantenimiento atendido por rol, dejarlos
  //    fuera sería que los reportes lleguen a un buzón cuyo aviso nadie ve.
  //
  // Ahora cuenta lo que esa persona tiene que atender de verdad: lo dirigido a ella, más lo que
  // entra a un buzón que ella atiende.
  const atiendeSoporte = !!user?.soporteTi;
  const atiendeMantenimiento = ["admin", "admin_plus", "rh", "psicologa"].includes(user?.role);

  const meToca = (m) => {
    if (m.leido || m.eliminado || m.de === user?.id) return false;
    if (m.para === user?.id) return true;
    if (!m.para) {
      if (m.canal === "soporte") return atiendeSoporte;
      if (m.canal === "mantenimiento") return atiendeMantenimiento;
    }
    return false;
  };

  const noLeidos = (mensajes || []).filter(meToca).length;

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
