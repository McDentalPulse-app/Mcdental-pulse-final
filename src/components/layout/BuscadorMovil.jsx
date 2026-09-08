import { useState, useRef, useEffect, useCallback } from "react";
import { useBuscadorGlobal } from "../../hooks/useBuscadorGlobal";
import Icon from "../ui/Icon";

/**
 * Búsqueda global del TELÉFONO — pedido del dueño: en escritorio ya existe (BuscadorGlobal, en
 * el header), pero en móvil no hay header (Navegacion.jsx monta Sidebar solo), así que no había
 * forma de buscar una pantalla por nombre.
 *
 * Botón flotante arriba a la izquierda, mismo aspecto y alto que `.campana` (arriba a la
 * derecha) — ícono nada más hasta que se toca, no una barra abierta todo el tiempo comiéndose
 * el ancho de una pantalla chica. Al tocar, despliega el campo + resultados debajo.
 */
export default function BuscadorMovil() {
  const { q, setQ, resultados, ir } = useBuscadorGlobal();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const cerrar = useCallback(() => { setAbierto(false); setQ(""); }, [setQ]);

  useEffect(() => {
    if (!abierto) return undefined;
    inputRef.current?.focus();
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar(); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto, cerrar]);

  const onKey = (e) => {
    if (e.key === "Enter" && resultados[0]) { ir(resultados[0].key); cerrar(); }
    if (e.key === "Escape") cerrar();
  };

  return (
    <div className="buscador-movil" ref={ref}>
      <button
        type="button"
        className="buscador-movil-boton"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Buscar en la app"
        aria-expanded={abierto}
      >
        <Icon name="search" size={18} />
      </button>
      {abierto && (
        <div className="buscador-movil-panel">
          <input
            ref={inputRef}
            className="buscador-movil-input"
            type="text"
            placeholder="Buscar en la app…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            aria-label="Buscar en la app"
          />
          {q.trim() && (
            resultados.length === 0 ? (
              <div className="buscador-vacio">Sin resultados para “{q.trim()}”</div>
            ) : (
              resultados.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="buscador-item"
                  onMouseDown={(e) => { e.preventDefault(); ir(item.key); cerrar(); }}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                  {item.group && <span className="buscador-grupo">{item.group}</span>}
                </button>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
