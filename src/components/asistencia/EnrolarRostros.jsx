import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import { useNotification } from "../../contexts/NotificationContext";
import { getRostros, revisarRostro, getSignedUrlRostro } from "../../services/supabase/rostrosService";

/**
 * Revisión de los rostros que los empleados registraron por su cuenta.
 *
 * ESTA PANTALLA ES EL COTEJO ENTERO. Todo lo demás —los modelos, las huellas, los
 * umbrales— depende de que aquí alguien mire las fotos y afirme: "esta cara es la de esta
 * persona".
 *
 * Si se aprueba sin mirar, el compañero que le robó la contraseña a Juan registra SU PROPIA
 * cara en la cuenta de Juan, se aprueba de un clic, y desde ese momento checa por él con un
 * 99% de parecido — verificado y bendecido por el sistema. El cotejo dejaría de detectar el
 * fraude: pasaría a certificarlo.
 *
 * Por eso las fotos se enseñan GRANDES y junto a la foto de perfil del empleado: aprobar
 * tiene que ser más fácil de hacer bien que de hacer mal.
 */
export default function EnrolarRostros({ usuarios = [] }) {
  const { toast, prompt } = useNotification();

  const [rostros, setRostros] = useState([]);
  const [urls, setUrls] = useState({}); // ruta -> url firmada
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null);

  // El estado se toca SOLO en los callbacks del promise, nunca en el cuerpo síncrono del
  // efecto: un setState síncrono ahí encadena un render extra en cada montaje.
  const cargar = useCallback(() => {
    getRostros()
      .then(setRostros)
      .catch((e) => toast.error(e?.message || "No se pudieron cargar los rostros."))
      .finally(() => setCargando(false));
  }, [toast]);

  useEffect(() => { cargar(); }, [cargar]);

  const porEmpleado = useMemo(
    () => new Map(rostros.map((r) => [r.empleadoId, r])),
    [rostros]
  );

  const nombrePorId = useMemo(
    () => new Map(usuarios.map((u) => [u.id, u.name])),
    [usuarios]
  );

  const pendientes = useMemo(
    () => usuarios
      .filter((u) => porEmpleado.get(u.id)?.estado === "pendiente")
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios, porEmpleado]
  );

  const empleados = useMemo(
    () => usuarios
      .filter((u) => !u.inactivo && ["empleado", "doctor"].includes(u.role))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios]
  );

  // Las fotos de los pendientes se firman al vuelo (bucket privado). Solo las de los
  // pendientes: firmar las de todos sería pedir decenas de URLs que nadie va a mirar.
  useEffect(() => {
    let activo = true;
    const rutas = pendientes.flatMap((u) => porEmpleado.get(u.id)?.fotos || []);

    Promise.all(rutas.map(async (ruta) => [ruta, await getSignedUrlRostro(ruta)]))
      .then((pares) => {
        if (activo) setUrls(Object.fromEntries(pares.filter(([, url]) => url)));
      });

    return () => { activo = false; };
  }, [pendientes, porEmpleado]);

  const revisar = async (empleado, aprobar) => {
    let motivo = null;

    if (!aprobar) {
      motivo = await prompt({
        title: `Rechazar el rostro de ${empleado.name}`,
        description: "¿Por qué? El empleado lo verá y podrá repetir las fotos.",
        confirmText: "Rechazar",
      });
      if (motivo === null) return;
    }

    setOcupado(empleado.id);
    try {
      const { aviso } = await revisarRostro({ empleadoId: empleado.id, aprobar, motivo });

      if (aviso) {
        // El servidor comparó esta cara contra todas las demás y se parece demasiado a otra. No
        // se deshace la aprobación —puede ser un hermano, y los hermanos también trabajan— pero
        // RH tiene que enterarse AHORA, que es cuando puede hacer algo: rehacer las fotos con
        // mejor luz, o al menos saber que esas dos personas son un punto ciego del cotejo.
        toast.warning(
          `${empleado.name} quedó verificado, pero su cara se parece mucho a la de ${aviso.nombre} (${aviso.score.toFixed(2)}). El cotejo podría llegar a confundirlos.`
        );
      } else {
        toast.success(aprobar ? `${empleado.name} quedó verificado.` : "Rostro rechazado.");
      }
      cargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo guardar la revisión.");
    } finally {
      setOcupado(null);
    }
  };

  // Un rostro caducado NO cuenta como verificado: ya no sirve para cotejar.
  const aprobados = empleados.filter((u) => {
    const r = porEmpleado.get(u.id);
    return r?.estado === "aprobado" && !r.caducado;
  }).length;

  const pillDe = (r) => {
    if (!r) return ["mc-status-pill--pendiente", "Sin registrar"];
    if (r.estado === "aprobado" && r.caducado) return ["mc-status-pill--rechazado", "Caducado"];
    if (r.estado === "aprobado") return ["mc-status-pill--aprobado", "Verificado"];
    if (r.estado === "pendiente") return ["mc-status-pill--pendiente", "En revisión"];
    return ["mc-status-pill--rechazado", "Rechazado"];
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="camera"
        title="Rostros"
        subtitle={`${aprobados} de ${empleados.length} empleados verificados`}
      />

      <Card>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          Al aprobar estás afirmando que <strong>esa cara es la de esa persona</strong>. Compárala
          con su foto de perfil. Si apruebas sin mirar, quien haya registrado la cara de otro
          quedará verificado por el sistema — y sus checadas falsas dejarán de detectarse.
        </p>
      </Card>

      {pendientes.length > 0 && (
        <>
          <SectionTitle icon="clock">Pendientes de revisar ({pendientes.length})</SectionTitle>

          {pendientes.map((u) => {
            const r = porEmpleado.get(u.id);
            return (
              <Card key={u.id} className="rostro-revision">
                <header className="rostro-revision-head">
                  <Avatar name={u.name} photoUrl={u.avatarUrl} size={44} />
                  <div className="rostro-revision-id">
                    <strong>{u.name}</strong>
                    <span>{[u.sucursal, u.puesto].filter(Boolean).join(" · ")}</span>
                  </div>
                </header>

                {/* Cotejo lado a lado: la foto que YA teníamos (perfil) contra las que la persona
                    acaba de registrar. Aprobar es afirmar que son la misma cara — la comparación
                    tiene que caer de un vistazo, no obligar a recordar cómo era el perfil. */}
                <div className="rostro-cotejo">
                  <figure className="rostro-cotejo-col rostro-cotejo-col--perfil">
                    <figcaption className="rostro-cotejo-label">Foto de perfil</figcaption>
                    <Avatar name={u.name} photoUrl={u.avatarUrl} size={132} />
                  </figure>

                  <figure className="rostro-cotejo-col">
                    <figcaption className="rostro-cotejo-label">
                      Registró {(r?.fotos || []).length === 1 ? "esta foto" : `estas ${(r?.fotos || []).length} fotos`}
                    </figcaption>
                    <div className="rostro-fotos">
                      {(r?.fotos || []).map((ruta) => (
                        urls[ruta]
                          ? <img key={ruta} src={urls[ruta]} alt={`Foto de ${u.name}`} className="rostro-foto" />
                          : <div key={ruta} className="rostro-foto rostro-foto--cargando" />
                      ))}
                    </div>
                  </figure>
                </div>

                <p className="rostro-cotejo-pregunta">¿Es la misma persona?</p>

                <div className="enrolar-acciones">
                  <button
                    type="button"
                    className="mc-btn-primary"
                    disabled={ocupado === u.id}
                    onClick={() => revisar(u, true)}
                  >
                    <Icon name="check" size={16} /> Sí, es {u.name.split(" ")[0]}
                  </button>
                  <button
                    type="button"
                    className="mc-btn-outline mc-btn-outline--danger"
                    disabled={ocupado === u.id}
                    onClick={() => revisar(u, false)}
                  >
                    <Icon name="xCircle" size={16} /> Rechazar
                  </button>
                </div>
              </Card>
            );
          })}
        </>
      )}

      <SectionTitle icon="users">Todos los empleados</SectionTitle>

      {cargando ? (
        <Card><p className="mc-empty">Cargando…</p></Card>
      ) : (
        <Card>
          <ul className="asistencia-revision">
            {empleados.map((u) => {
              const r = porEmpleado.get(u.id);
              const [clase, texto] = pillDe(r);
              // El parecido no caduca con el toast del día que se aprobó: si dos caras pueden
              // confundirse, eso sigue siendo verdad dentro de tres meses, y el RH que abra esta
              // lista entonces tiene que verlo sin haber estado aquí aquel día.
              const parecido = r?.parecidoMaximo != null && r.parecidoMaximo >= 0.4
                ? nombrePorId.get(r.parecidoCon)
                : null;
              return (
                <li key={u.id}>
                  <Avatar name={u.name} photoUrl={u.avatarUrl} size={32} />
                  <div className="asistencia-revision-main">
                    <strong>{u.name}</strong>
                    <span>
                      {u.sucursal}
                      {parecido && (
                        <em className="rostro-parecido">
                          {" "}· se parece a {parecido} ({r.parecidoMaximo.toFixed(2)})
                        </em>
                      )}
                    </span>
                  </div>
                  <div className="asistencia-revision-acciones">
                    <span className={`mc-status-pill ${clase}`}>{texto}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
