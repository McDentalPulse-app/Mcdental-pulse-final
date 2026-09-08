import { useState, useRef, useEffect } from "react";
import { useBuscadorGlobal } from "../../hooks/useBuscadorGlobal";
import Icon from "../ui/Icon";

// Búsqueda global de escritorio: filtra las páginas del rol actual por nombre y navega a la
// elegida. Enter va al primer resultado. Lógica de filtrado compartida con BuscadorMovil.jsx
// vía useBuscadorGlobal — solo cambia la presentación (esto es una barra siempre abierta).
export default function BuscadorGlobal() {
  const { q, setQ, resultados, ir } = useBuscadorGlobal();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const irYcerrar = (key) => { ir(key); setAbierto(false); };

  const onKey = (e) => {
    if (e.key === "Enter" && resultados[0]) irYcerrar(resultados[0].key);
    if (e.key === "Escape") { setQ(""); setAbierto(false); e.currentTarget.blur(); }
  };

  return (
    <div className="buscador" ref={ref}>
      <Icon name="search" size={17} className="buscador-ico" />
      <input
        className="buscador-input"
        type="text"
        placeholder="Buscar…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={onKey}
        aria-label="Buscar en la app"
      />
      {abierto && q.trim() && (
        <div className="buscador-panel">
          {resultados.length === 0 ? (
            <div className="buscador-vacio">Sin resultados para “{q.trim()}”</div>
          ) : (
            resultados.map((item) => (
              <button key={item.key} type="button" className="buscador-item" onMouseDown={(e) => { e.preventDefault(); irYcerrar(item.key); }}>
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
                {item.group && <span className="buscador-grupo">{item.group}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
