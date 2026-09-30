import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import DateRangePicker from "../common/DateRangePicker";
import { saldoVacaciones, diasVacacionHabiles } from "../../utils/vacaciones";
import { TZ_CLINICA } from "../../utils/asistencia";
import { formatFechaCorta } from "../../utils/helpers";
import { normalizeSucursal } from "../../utils/constants";
import { useNotification } from "../../contexts/NotificationContext";

const hoyClinica = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ_CLINICA }).format(new Date());

// Sin acentos ni mayúsculas: "maria" encuentra a "MARÍA".
const normalizar = (t) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * RH / psicóloga registran vacaciones a nombre de cualquier persona (pedido del dueño,
 * 2026-09-30). Cualquier día, sin la anticipación ni el plazo que se le exigen al empleado:
 * quedan APROBADAS en el acto, gastan su saldo y la nómina las toma como días justificados,
 * igual que unas vacaciones pedidas por él. Si se pasa de su saldo se avisa, pero se deja
 * guardar: es gestión y puede hacer excepciones (la base tampoco se lo impide, mig. 162).
 */
export default function RegistrarVacacionesModal({ usuarios = [], vacaciones = [], onRegistrar, onCerrar }) {
  const { toast } = useNotification();
  const [busqueda, setBusqueda] = useState("");
  const [empleado, setEmpleado] = useState(null);
  const [desde, setDesde] = useState(hoyClinica());
  const [hasta, setHasta] = useState(hoyClinica());
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const candidatos = useMemo(() => {
    const activos = usuarios.filter((u) => !u.inactivo && !u.archivado && !u.oculto);
    const q = normalizar(busqueda.trim());
    if (!q) return [];
    return activos.filter((u) => normalizar(`${u.name} ${u.puesto} ${u.sucursal}`).includes(q)).slice(0, 8);
  }, [usuarios, busqueda]);

  const dias = diasVacacionHabiles(desde, hasta);
  const domingos = desde && hasta && hasta >= desde
    ? Math.round((new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / 86400000) + 1 - dias
    : 0;
  const saldo = empleado
    ? saldoVacaciones(empleado.fechaIngreso, vacaciones.filter((v) => v.empleadoId === empleado.id), hoyClinica())
    : null;
  const excede = saldo?.desbloqueado && dias > saldo.disponibles;

  const guardar = async () => {
    if (!empleado) { toast.warning("Elige a la persona."); return; }
    if (!desde || !hasta || hasta < desde) { toast.warning("Elige las fechas."); return; }
    if (dias === 0) { toast.warning("El domingo no se trabaja, así que no gasta vacaciones. Elige al menos un día que trabaje."); return; }
    if (!motivo.trim()) { toast.warning("Escribe el motivo."); return; }
    setGuardando(true);
    const ok = await onRegistrar({ empleadoId: empleado.id, fechaInicio: desde, fechaFin: hasta, dias, motivo: motivo.trim() });
    setGuardando(false);
    if (ok) {
      toast.success(`Vacaciones registradas para ${empleado.name}.`);
      onCerrar();
    }
  };

  return createPortal(
    <div className="mc-modal-overlay" onClick={() => !guardando && onCerrar()} role="presentation">
      <div className="mc-modal rh-vac-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rh-vac-titulo">
        <div className="rh-vac-modal-head">
          <div>
            <h2 id="rh-vac-titulo" className="mc-modal-title">Registrar vacaciones</h2>
            <p className="rh-vac-modal-sub">Quedan aprobadas al guardar y se toman en cuenta en su saldo y en la nómina.</p>
          </div>
          <button type="button" className="rh-vac-cerrar" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mc-form-grid">
          <div className="mc-form-group">
            <span className="mc-form-label">Persona</span>
            {empleado ? (
              <div className="rh-vac-elegido">
                <Avatar name={empleado.name} photoUrl={empleado.avatarUrl} size={36} zoom={false} />
                <div className="rh-vac-elegido-info">
                  <span className="rh-vac-elegido-nombre">{empleado.name}</span>
                  <span className="rh-vac-elegido-meta">{empleado.puesto} · {normalizeSucursal(empleado.sucursal)}</span>
                </div>
                <button type="button" className="mc-btn-outline" onClick={() => { setEmpleado(null); setBusqueda(""); }} disabled={guardando}>Cambiar</button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  className="mc-form-input"
                  placeholder="Buscar por nombre, puesto o sucursal…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  autoFocus
                />
                {candidatos.length > 0 && (
                  <div className="rh-vac-candidatos">
                    {candidatos.map((u) => (
                      <button key={u.id} type="button" className="rh-vac-candidato" onClick={() => setEmpleado(u)}>
                        <Avatar name={u.name} photoUrl={u.avatarUrl} size={30} zoom={false} />
                        <span className="rh-vac-elegido-info">
                          <span className="rh-vac-elegido-nombre">{u.name}</span>
                          <span className="rh-vac-elegido-meta">{u.puesto} · {normalizeSucursal(u.sucursal)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {busqueda.trim() && candidatos.length === 0 && <p className="mc-form-hint">Nadie coincide con esa búsqueda.</p>}
              </>
            )}
          </div>

          {saldo && (
            <div className={`admin-info-box empleado-days-hint${excede ? " rh-vac-excede" : ""}`}>
              <Icon name="vacation" size={16} />
              <span>
                {saldo.desbloqueado ? (
                  <>Le quedan <strong>{saldo.disponibles}</strong> de {saldo.total} días en su periodo actual (hasta el {formatFechaCorta(saldo.periodo.fin)}).</>
                ) : (
                  <>Todavía no cumple su primer año (se desbloquean el {formatFechaCorta(saldo.proximoAniversario)}).</>
                )}
                {excede && <> <strong>Con estas fechas se pasa de su saldo</strong>; se puede registrar igual.</>}
              </span>
            </div>
          )}

          <div className="mc-form-group">
            <span className="mc-form-label">Fechas</span>
            <DateRangePicker desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h); }} />
            {dias > 0 && (
              <p className="mc-form-hint">
                <strong>{dias}</strong> {dias === 1 ? "día" : "días"} de vacaciones
                {domingos > 0 && ` · ${domingos === 1 ? "el domingo no cuenta" : `los ${domingos} domingos no cuentan`}`}
              </p>
            )}
          </div>

          <div className="mc-form-group">
            <label className="mc-form-label" htmlFor="rh-vac-motivo">Motivo</label>
            <input id="rh-vac-motivo" className="mc-form-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Vacaciones de fin de año" />
          </div>

          <div className="mc-form-actions">
            <button type="button" className="mc-btn-secondary" onClick={onCerrar} disabled={guardando}>Cancelar</button>
            <button type="button" className="mc-btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Registrar y aprobar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
