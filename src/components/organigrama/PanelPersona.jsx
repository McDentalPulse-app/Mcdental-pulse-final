import { useState, useMemo } from "react";
import Icon from "../ui/Icon";
import Card from "../common/Card";
import Select from "../common/Select";
import { notify } from "../../utils/notify";
import { updateUsuario } from "../../services/supabase/usuariosService";

/** ¿"candidatoId" ya depende (directa o indirectamente) de "deId"? Recorre hacia ARRIBA desde
 * candidatoId por la cadena de jefes: si llega a deId, ofrecerlo como su jefe crearía un ciclo.
 * El trigger de la mig. 153 es la red real; esto es solo no ofrecer una opción que va a fallar. */
const dependeDe = (candidatoId, deId, usuariosPorId) => {
  let actual = usuariosPorId.get(candidatoId);
  let saltos = 0;
  while (actual?.jefeId && saltos < 50) {
    if (actual.jefeId === deId) return true;
    actual = usuariosPorId.get(actual.jefeId);
    saltos += 1;
  }
  return false;
};

/**
 * Detalle de una persona del organigrama: a quién reporta, quiénes le reportan, y —solo para
 * admin/admin_plus/rh (mig. 153)— los dos desplegables para moverla de rama o de departamento.
 */
export default function PanelPersona({ persona, usuarios, areas, puedeEditar, onCerrar, onGuardado }) {
  const [guardando, setGuardando] = useState(false);

  const usuariosPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);
  const jefe = persona.jefeId ? usuariosPorId.get(persona.jefeId) : null;
  const area = persona.areaId ? areas.find((a) => a.id === persona.areaId) : null;
  const reportes = useMemo(
    () => usuarios.filter((u) => u.jefeId === persona.id && !u.archivado),
    [usuarios, persona.id]
  );

  const candidatosJefe = useMemo(
    () =>
      usuarios
        .filter((u) => !u.archivado && u.id !== persona.id && !dependeDe(u.id, persona.id, usuariosPorId))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [usuarios, persona.id, usuariosPorId]
  );

  const guardar = async (campo, valor, mensaje) => {
    setGuardando(true);
    try {
      await updateUsuario(persona.id, { [campo]: valor || null });
      notify.toast.success(mensaje);
      onGuardado?.();
    } catch (error) {
      notify.toast.error(error.message || "No se pudo guardar el cambio.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="organigrama-panel-persona">
      <div className="organigrama-panel-header">
        {persona.avatarUrl ? (
          <img className="organigrama-panel-avatar" src={persona.avatarUrl} alt="" />
        ) : (
          <div className="organigrama-panel-avatar organigrama-panel-avatar--vacio"><Icon name="user" size={20} /></div>
        )}
        <div className="organigrama-panel-titulo">
          <div className="organigrama-panel-nombre">{persona.name}</div>
          {persona.puesto && <div className="organigrama-panel-puesto">{persona.puesto}</div>}
        </div>
        <button type="button" className="organigrama-panel-cerrar" onClick={onCerrar} aria-label="Cerrar detalle">
          <Icon name="close" size={18} />
        </button>
      </div>

      {persona.inactivo && (
        <div className="organigrama-panel-aviso">De baja temporal — sigue en el organigrama, marcada aparte.</div>
      )}

      <dl className="organigrama-panel-datos">
        <div><dt>Departamento</dt><dd>{area?.nombre || "Sin departamento"}</dd></div>
        <div><dt>Sucursal</dt><dd>{persona.sucursal || "—"}</dd></div>
        <div><dt>Reporta a</dt><dd>{jefe ? jefe.name : "— (raíz del organigrama)"}</dd></div>
        <div><dt>Le reportan</dt><dd>{reportes.length}</dd></div>
      </dl>

      {puedeEditar && (
        <div className="organigrama-panel-edicion">
          <label className="organigrama-panel-campo">
            Jefe directo
            <Select
              value={persona.jefeId || ""}
              disabled={guardando}
              placeholder="— Sin jefe (raíz) —"
              onChange={(valor) => guardar("jefeId", valor, "Jefe directo actualizado.")}
            >
              {candidatosJefe.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </label>
          <label className="organigrama-panel-campo">
            Departamento
            <Select
              value={persona.areaId || ""}
              disabled={guardando}
              placeholder="— Sin departamento —"
              onChange={(valor) => guardar("areaId", valor, "Departamento actualizado.")}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </Select>
          </label>
        </div>
      )}
    </Card>
  );
}
