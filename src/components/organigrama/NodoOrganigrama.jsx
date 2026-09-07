import Icon from "../ui/Icon";

/**
 * Un nivel del organigrama, recursivo. Dos tipos de caja:
 * - "persona": nombre real, con sus propios hijos (más personas o grupos) debajo.
 * - "grupo": "Dentistas · 14" — hermanos con el mismo puesto, sin hijos propios; al abrirse
 *   despliega la lista real de miembros, cada uno clickeable para ver su detalle.
 *
 * Layout vertical con sangría (no diagrama horizontal): es lo que cabe en un teléfono sin
 * scroll lateral, y con ~100 personas hoy un diagrama de cajas y líneas sería ilegible ahí.
 */
const NodoOrganigrama = ({ nodo, expandidos, onToggle, onSeleccionar, seleccionadoId }) => {
  const abierto = expandidos.has(nodo.id);

  if (nodo.tipo === "grupo") {
    return (
      <li className="organigrama-nodo organigrama-nodo--grupo">
        <button type="button" className="organigrama-caja organigrama-caja--grupo" onClick={() => onToggle(nodo.id)}>
          <Icon name="chevronDown" size={16} className={`organigrama-chevron${abierto ? "" : " organigrama-chevron--cerrado"}`} />
          <span className="organigrama-nombre">{nodo.puesto || "Sin puesto"}</span>
          <span className="organigrama-conteo">· {nodo.personas.length}</span>
        </button>
        {abierto && (
          <ul className="organigrama-hijos organigrama-hijos--grupo">
            {[...nodo.personas].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`organigrama-caja organigrama-caja--miembro${p.inactivo ? " organigrama-caja--inactivo" : ""}${seleccionadoId === p.id ? " organigrama-caja--activa" : ""}`}
                  onClick={() => onSeleccionar(p)}
                >
                  {p.name}
                  {p.inactivo && <span className="organigrama-etiqueta-inactivo">De baja</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  const { persona, hijos } = nodo;
  const tieneHijos = hijos.length > 0;

  return (
    <li className="organigrama-nodo">
      <div className={`organigrama-caja${persona.inactivo ? " organigrama-caja--inactivo" : ""}${seleccionadoId === persona.id ? " organigrama-caja--activa" : ""}`}>
        {tieneHijos ? (
          <button
            type="button"
            className="organigrama-toggle"
            onClick={() => onToggle(nodo.id)}
            aria-label={abierto ? "Colapsar rama" : "Expandir rama"}
            aria-expanded={abierto}
          >
            <Icon name="chevronDown" size={16} className={`organigrama-chevron${abierto ? "" : " organigrama-chevron--cerrado"}`} />
          </button>
        ) : (
          <span className="organigrama-toggle organigrama-toggle--vacio" aria-hidden="true" />
        )}
        <button type="button" className="organigrama-persona" onClick={() => onSeleccionar(persona)}>
          <span className="organigrama-nombre">{persona.name}</span>
          {persona.puesto && <span className="organigrama-puesto">{persona.puesto}</span>}
          {persona.inactivo && <span className="organigrama-etiqueta-inactivo">De baja</span>}
        </button>
      </div>
      {tieneHijos && abierto && (
        <ul className="organigrama-hijos">
          {hijos.map((h) => (
            <NodoOrganigrama
              key={h.id}
              nodo={h}
              expandidos={expandidos}
              onToggle={onToggle}
              onSeleccionar={onSeleccionar}
              seleccionadoId={seleccionadoId}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default NodoOrganigrama;
