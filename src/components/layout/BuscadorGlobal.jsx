import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useGlobal } from "../../contexts/GlobalContext";
import { navItemsPara, rutaBaseDe } from "../../config/navItems";
import Icon from "../ui/Icon";

// Búsqueda global: filtra las páginas del rol actual por nombre y navega a la elegida.
// Insensible a mayúsculas y acentos. Enter va al primer resultado.
const normalizar = (s) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export default function BuscadorGlobal() {
  const { user } = useAuth();
  const { modulosRol } = useGlobal();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  const items = navItemsPara(user, modulosRol).filter((i) => i.group !== "Cuenta");
  const nq = normalizar(q.trim());
  const resultados = nq ? items.filter((i) => normalizar(i.label).includes(nq)).slice(0, 8) : [];

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const ir = (key) => { setQ(""); setAbierto(false); navigate(`/${rutaBaseDe(user.role)}/${key}`); };

  const onKey = (e) => {
    if (e.key === "Enter" && resultados[0]) ir(resultados[0].key);
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
              <button key={item.key} type="button" className="buscador-item" onMouseDown={(e) => { e.preventDefault(); ir(item.key); }}>
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
