import { useState, useMemo } from "react";
import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import { esEmpleadoActivo } from "../../utils/helpers";

/**
 * Formulario para convocar una reunión.
 *
 * El selector filtra sobre la plantilla activa: invitar a alguien dado de baja crea una
 * reunión a la que no puede entrar, y el fallo solo se descubre a la hora de empezar. El
 * servidor lo vuelve a comprobar de todas formas — esto es comodidad, no seguridad.
 */
const NuevaReunion = ({ usuarios, miId, onCrear, onCancelar, creando }) => {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cuando, setCuando] = useState("");
  const [busca, setBusca] = useState("");
  const [elegidos, setElegidos] = useState([]);

  const candidatos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return usuarios
      .filter((u) => u.id !== miId && esEmpleadoActivo(u))
      .filter((u) => !q || `${u.name} ${u.puesto || ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [usuarios, miId, busca]);

  const alternar = (id) =>
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const listo = titulo.trim() && cuando && elegidos.length > 0 && !creando;

  return (
    <div className="reunion-form">
      <div className="reunion-form-campos">
        <label className="reunion-campo">
          <span>Título</span>
          <input
            className="mc-form-input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Reunión de seguimiento"
            maxLength={160}
          />
        </label>

        <label className="reunion-campo">
          <span>Cuándo</span>
          <input
            className="mc-form-input"
            type="datetime-local"
            value={cuando}
            onChange={(e) => setCuando(e.target.value)}
          />
        </label>
      </div>

      <label className="reunion-campo">
        <span>Descripción <small>(opcional)</small></span>
        <textarea
          className="mc-form-textarea"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="De qué se va a hablar"
        />
      </label>

      <div className="reunion-campo">
        <span>
          A quién invitas
          {elegidos.length > 0 && <em className="reunion-contador">{elegidos.length} elegidas</em>}
        </span>
        <input
          className="mc-form-input"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nombre o puesto…"
        />

        <div className="reunion-personal">
          {candidatos.length === 0 ? (
            <div className="reunion-personal-vacio">Nadie coincide con esa búsqueda.</div>
          ) : candidatos.map((u) => {
            const puesto = elegidos.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                className={`reunion-persona${puesto ? " reunion-persona--elegida" : ""}`}
                onClick={() => alternar(u.id)}
                aria-pressed={puesto}
              >
                <Avatar name={u.name} size={30} photoUrl={u.avatarUrl} color="var(--mc-texto-secundario)" />
                <span className="reunion-persona-datos">
                  <span className="reunion-persona-nombre">{u.name}</span>
                  <span className="reunion-persona-puesto">{u.puesto || u.sucursal || ""}</span>
                </span>
                {puesto && <Icon name="check" size={16} className="reunion-persona-check" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="reunion-form-acciones">
        <button type="button" className="mc-btn-secundario" onClick={onCancelar} disabled={creando}>
          Cancelar
        </button>
        <button
          type="button"
          className="mc-btn-primary mc-btn-with-icon"
          disabled={!listo}
          onClick={() =>
            onCrear({
              titulo: titulo.trim(),
              descripcion: descripcion.trim() || null,
              // El input da hora local; se manda en ISO para que no dependa de la zona del
              // aparato que convoca.
              inicio: new Date(cuando).toISOString(),
              invitados: elegidos,
            })
          }
        >
          <Icon name="send" size={16} />
          {creando ? "Convocando…" : "Convocar e invitar"}
        </button>
      </div>
    </div>
  );
};

export default NuevaReunion;
