import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import SectionTitle from "../common/SectionTitle";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import CapturaSelfie from "./CapturaSelfie";
import { useNotification } from "../../contexts/NotificationContext";
import { getRostros, enrolarRostro } from "../../services/supabase/rostrosService";
import { RESULTADO, MENSAJE } from "../../utils/rostro";

/**
 * Enrolado de la cara de referencia. Lo hace RH, con el empleado DELANTE.
 *
 * Es la parte que no se puede saltar. Si el empleado pudiera enrolarse solo desde su casa,
 * el compañero que le robó la contraseña enrolaría SU PROPIA cara en la cuenta ajena, y a
 * partir de ese momento checaría por él con un parecido del 99%: verificado, bendecido por
 * el sistema y absolutamente indetectable. El fraude quedaría legitimado.
 *
 * De ahí el consentimiento explícito: una cara cotejada es dato personal SENSIBLE, y este
 * es el momento —cara a cara— en que la persona lo acepta o no.
 */
export default function EnrolarRostros({ usuarios = [] }) {
  const { toast, confirm } = useNotification();
  const camaraRef = useRef(null);

  const [rostros, setRostros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enrolando, setEnrolando] = useState(null); // empleado en curso
  const [consentido, setConsentido] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    getRostros()
      .then((r) => { if (activo) setRostros(r); })
      .catch((e) => { if (activo) toast.error(e?.message || "No se pudo cargar el enrolado."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [toast]);

  const empleados = useMemo(
    () => usuarios
      .filter((u) => !u.inactivo && u.role === "empleado")
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios]
  );

  const enrolados = useMemo(
    () => new Set(rostros.map((r) => r.empleadoId)),
    [rostros]
  );

  const abrir = (empleado) => {
    setEnrolando(empleado);
    setConsentido(false);
  };

  const cerrar = () => {
    setEnrolando(null);
    setConsentido(false);
  };

  const capturarYEnrolar = async () => {
    if (!enrolando || !consentido || guardando) return;
    setGuardando(true);

    try {
      const foto = await camaraRef.current?.capturar();

      if (!foto?.blob) {
        toast.error(MENSAJE[foto?.resultado] || "No se pudo tomar la foto. Inténtalo de nuevo.");
        return;
      }
      if (foto.resultado === RESULTADO.NO_DISPONIBLE) {
        // Aquí SÍ se exige el detector, al revés que en el checador: si se enrola una foto
        // sin comprobar que hay una cara, se está grabando basura como cara de referencia
        // de una persona, y todos sus cotejos futuros fallarán sin que nadie entienda por
        // qué. Un enrolado se puede repetir con calma; una checada, no.
        toast.error("No se pudo comprobar la foto. Recarga la página e inténtalo de nuevo.");
        return;
      }

      const ok = await confirm({
        title: `Enrolar a ${enrolando.name}`,
        description:
          "Confirmas que la persona está presente, que se le explicó para qué se usará su rostro, " +
          "y que dio su consentimiento. Quedará registrado con tu nombre y la fecha.",
        confirmText: "Enrolar",
      });
      if (!ok) return;

      await enrolarRostro({ empleadoId: enrolando.id, foto: foto.blob, consentimiento: true });

      setRostros((prev) => [
        ...prev.filter((r) => r.empleadoId !== enrolando.id),
        { empleadoId: enrolando.id, enroladoEn: new Date().toISOString() },
      ]);
      toast.success(`${enrolando.name} quedó enrolado.`);
      cerrar();
    } catch (e) {
      toast.error(e?.message || "No se pudo enrolar el rostro.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        icon="camera"
        title="Rostros"
        subtitle={`${enrolados.size} de ${empleados.length} empleados tienen su rostro registrado`}
      />

      <Card>
        <p className="mc-hint">
          <Icon name="alert" size={15} />
          El registro se hace <strong>con la persona delante</strong> y solo con su consentimiento.
          Un rostro es un dato personal sensible: quien no quiera registrarlo puede seguir checando
          igual — su checada simplemente no se cotejará.
        </p>
      </Card>

      {enrolando && (
        <Card className="enrolar-panel">
          <SectionTitle icon="camera">Registrando a {enrolando.name}</SectionTitle>

          <CapturaSelfie ref={camaraRef} activa />

          <label className="enrolar-consentimiento">
            <input
              type="checkbox"
              checked={consentido}
              onChange={(e) => setConsentido(e.target.checked)}
            />
            <span>
              {enrolando.name} está presente, se le explicó que su rostro se usará únicamente para
              comprobar sus checadas de entrada y salida, y dio su consentimiento.
            </span>
          </label>

          <div className="enrolar-acciones">
            <button
              type="button"
              className="mc-btn-primary"
              disabled={!consentido || guardando}
              onClick={capturarYEnrolar}
            >
              <Icon name="camera" size={16} />
              {guardando ? "Registrando…" : "Tomar foto y registrar"}
            </button>
            <button type="button" className="mc-btn-outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </button>
          </div>
        </Card>
      )}

      <SectionTitle icon="users">Empleados</SectionTitle>

      {cargando ? (
        <Card><p className="mc-empty">Cargando…</p></Card>
      ) : (
        <Card>
          <ul className="asistencia-revision">
            {empleados.map((u) => (
              <li key={u.id}>
                <Avatar name={u.name} photoUrl={u.avatarUrl} size={32} />
                <div className="asistencia-revision-main">
                  <strong>{u.name}</strong>
                  <span>{u.sucursal}</span>
                </div>
                <div className="asistencia-revision-acciones">
                  {enrolados.has(u.id) ? (
                    <span className="mc-status-pill mc-status-pill--aprobado">Registrado</span>
                  ) : (
                    <span className="mc-status-pill mc-status-pill--pendiente">Sin registrar</span>
                  )}
                  <button
                    type="button"
                    className="mc-btn-outline"
                    onClick={() => abrir(u)}
                    disabled={!!enrolando}
                  >
                    {enrolados.has(u.id) ? "Volver a tomar" : "Registrar rostro"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
