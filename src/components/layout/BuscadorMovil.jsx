import { useState, useRef, useEffect, useCallback } from "react";
import { useBuscadorGlobal } from "../../hooks/useBuscadorGlobal";
import Icon from "../ui/Icon";

/**
 * Búsqueda global del TELÉFONO. Vive como una barra completa DENTRO de la barra de navegación de
 * abajo (Sidebar.jsx), debajo de los tabs — pedido del dueño: "queda más alcanzable y se puede
 * poner la barra completa". En escritorio esto no se monta: ahí está BuscadorGlobal, en el header.
 *
 * La barra de abajo es solo el DISPARADOR; al tocarla se abre una capa a pantalla completa con el
 * campo real arriba. No es un capricho: un `<input>` fijo pegado al borde inferior queda tapado
 * por el teclado en iOS (el `position: fixed` se ancla al viewport de layout, no al visual), y
 * esta app se usa desde iPhone, Chrome de Android y HuaweiBrowser, donde eso se comporta distinto
 * en cada uno. Con el campo arriba, ningún teclado lo cubre.
 */
export default function BuscadorMovil() {
  const { q, setQ, resultados, ir } = useBuscadorGlobal();
  const [abierto, setAbierto] = useState(false);
  const inputRef = useRef(null);

  const cerrar = useCallback(() => { setAbierto(false); setQ(""); }, [setQ]);

  useEffect(() => {
    if (!abierto) return undefined;
    inputRef.current?.focus();
    const alTeclear = (e) => { if (e.key === "Escape") cerrar(); };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto, cerrar]);

  const elegir = (key) => { ir(key); cerrar(); };

  return (
    <>
      <button type="button" className="buscador-movil-barra" onClick={() => setAbierto(true)}>
        <Icon name="search" size={16} />
        <span>Buscar en la app…</span>
      </button>

      {abierto && (
        <div className="buscador-movil-overlay" onClick={cerrar} role="presentation">
          <div className="buscador-movil-caja" onClick={(e) => e.stopPropagation()} role="search">
            <div className="buscador-movil-campo">
              <Icon name="search" size={17} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar en la app…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && resultados[0]) elegir(resultados[0].key); }}
                aria-label="Buscar en la app"
              />
              <button type="button" className="buscador-movil-cerrar" onClick={cerrar} aria-label="Cerrar búsqueda">
                <Icon name="close" size={18} />
              </button>
            </div>
            {q.trim() && (
              <div className="buscador-movil-resultados">
                {resultados.length === 0 ? (
                  <div className="buscador-vacio">Sin resultados para “{q.trim()}”</div>
                ) : (
                  resultados.map((item) => (
                    <button key={item.key} type="button" className="buscador-item" onClick={() => elegir(item.key)}>
                      <Icon name={item.icon} size={16} />
                      <span>{item.label}</span>
                      {item.group && <span className="buscador-grupo">{item.group}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
