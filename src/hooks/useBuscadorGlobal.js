import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useGlobal } from "../contexts/GlobalContext";
import { navItemsPara, rutaBaseDe } from "../config/navItems";

// Compartido por BuscadorGlobal.jsx (escritorio) y BuscadorMovil.jsx (teléfono): filtra las
// páginas del rol actual por nombre y arma la navegación. Insensible a mayúsculas y acentos.
const normalizar = (s) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export const useBuscadorGlobal = () => {
  const { user } = useAuth();
  const { modulosRol } = useGlobal();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const items = navItemsPara(user, modulosRol).filter((i) => i.group !== "Cuenta");
  const nq = normalizar(q.trim());
  const resultados = nq ? items.filter((i) => normalizar(i.label).includes(nq)).slice(0, 8) : [];

  const ir = (key) => { setQ(""); navigate(`/${rutaBaseDe(user.role)}/${key}`); };

  return { q, setQ, resultados, ir };
};
