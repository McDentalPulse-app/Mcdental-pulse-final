import { useState, useEffect } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import Card from "../common/Card";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import NuevaReunion from "./NuevaReunion";
import { notify } from "../../utils/notify";
import { enCurso } from "../../utils/reuniones";
import { crearReunion, responderInvitacion } from "../../services/supabase/reunionesService";

const PUEDE_CONVOCAR = ["admin", "admin_plus", "rh", "psicologa"];

const fmt = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Monterrey",
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

const Reuniones = ({ user, onEntrar }) => {
  // Las reuniones y su refresco vienen del contexto: el icono de la cabecera las necesita en
  // todas las pantallas, y tenerlas también aquí serían dos fuentes que pueden discrepar.
  const { usuarios: USERS, reuniones, refreshReuniones } = useGlobal();
  const [creando, setCreando] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  // El "ahora" vive en estado y avanza solo. Calcularlo en el render sería impuro (lo marca
  // el linter) y, sobre todo, dejaría una reunión que acaba de empezar mostrando "Programada"
  // hasta que alguien recargara la página: justo cuando hay que entrar.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const puedeConvocar = PUEDE_CONVOCAR.includes(user?.role);
  const nombreDe = (id) => USERS.find((u) => u.id === id)?.name || "Alguien";

  const crear = async (datos) => {
    setCreando(true);
    try {
      await crearReunion(datos);
      setFormAbierto(false);
      refreshReuniones();
      notify.toast.success("Reunión convocada. Ya les llegó el aviso.");
    } catch (e) {
      notify.toast.error(e?.message || "No se pudo crear la reunión.");
    } finally {
      setCreando(false);
    }
  };

  const responder = async (r, estado) => {
    try {
      await responderInvitacion({ reunionId: r.id, usuarioId: user.id, estado });
      refreshReuniones();
    } catch (e) {
      notify.toast.error(e?.message || "No se pudo responder.");
    }
  };

  return (
    <div className="reuniones">
      <div className="reuniones-cabecera">
        <span className="reuniones-titulo">
          <Icon name="camera" size={16} /> Reuniones
        </span>
        {puedeConvocar && !formAbierto && (
          <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => setFormAbierto(true)}>
            <Icon name="plus" size={16} /> Nueva reunión
          </button>
        )}
      </div>

      {formAbierto && (
        <Card className="reunion-form-card">
          <NuevaReunion
            usuarios={USERS}
            miId={user.id}
            onCrear={crear}
            onCancelar={() => setFormAbierto(false)}
            creando={creando}
          />
        </Card>
      )}

      {reuniones.length === 0 && !formAbierto ? (
        <Card className="reuniones-vacio">
          <div className="mc-empty-state">
            <div className="mc-empty-state-icon"><Icon name="camera" size={22} /></div>
            <div className="mc-empty-state-title">No hay reuniones</div>
            <p className="mc-empty-state-message">
              {puedeConvocar
                ? "Convoca una y elige a quién invitas."
                : "Aquí aparecerán las reuniones a las que te inviten."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="reuniones-lista">
          {reuniones.map((r) => {
            const inicio = new Date(r.inicio);
            const abierta = enCurso(r, ahora);
            const cancelada = r.estado === "cancelada";
            const miInvitacion = r.invitados.find((i) => i.usuarioId === user.id);
            const soyAnfitrion = r.creadoPor === user.id;

            return (
              <Card key={r.id} className={`reunion-item${abierta ? " reunion-item--activa" : ""}`}>
                <div className="reunion-item-cabecera">
                  <div>
                    <div className="reunion-item-titulo">{r.titulo}</div>
                    <div className="reunion-item-cuando">
                      {fmt.format(inicio)}
                      {soyAnfitrion
                        ? <span className="reunion-etiqueta">Tú convocas</span>
                        : <span className="reunion-item-anfitrion"> · {nombreDe(r.creadoPor)}</span>}
                    </div>
                  </div>

                  {cancelada ? (
                    <span className="reunion-etiqueta reunion-etiqueta--cancelada">Cancelada</span>
                  ) : abierta ? (
                    <button type="button" className="mc-btn-primary mc-btn-with-icon" onClick={() => onEntrar(r)}>
                      <Icon name="camera" size={16} /> Entrar
                    </button>
                  ) : (
                    // Fuera de su horario no se ofrece entrar: una sala vacía a la que se puede
                    // pasar en cualquier momento deja de ser una reunión convocada.
                    <span className="reunion-etiqueta">
                      {inicio.getTime() > ahora ? "Programada" : "Terminada"}
                    </span>
                  )}
                </div>

                {r.descripcion && <p className="reunion-item-desc">{r.descripcion}</p>}

                <div className="reunion-item-gente">
                  {r.invitados.slice(0, 8).map((i) => (
                    <span key={i.usuarioId} title={`${nombreDe(i.usuarioId)} · ${i.estado}`}>
                      <Avatar
                        name={nombreDe(i.usuarioId)}
                        size={26}
                        photoUrl={USERS.find((u) => u.id === i.usuarioId)?.avatarUrl}
                        color="var(--mc-texto-secundario)"
                      />
                    </span>
                  ))}
                  {r.invitados.length > 8 && (
                    <span className="reunion-item-mas">+{r.invitados.length - 8}</span>
                  )}
                </div>

                {/* Solo se pregunta a quien no ha contestado todavía, y nunca al anfitrión. */}
                {!soyAnfitrion && !cancelada && miInvitacion?.estado === "invitado" && (
                  <div className="reunion-item-respuesta">
                    <span>¿Vas a asistir?</span>
                    <button type="button" className="mc-btn-outline" onClick={() => responder(r, "rechaza")}>
                      No puedo
                    </button>
                    <button type="button" className="mc-btn-primary" onClick={() => responder(r, "acepta")}>
                      Ahí estaré
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Reuniones;
