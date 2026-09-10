import { useState, useMemo } from "react";
import { useGlobal } from "../../contexts/GlobalContext";
import PageHeader from "../common/PageHeader";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import Icon from "../ui/Icon";
import { construirArbol } from "../../utils/organigrama/arbol";
import MapaOrganigrama from "./MapaOrganigrama";
import PanelPersona from "./PanelPersona";
import ResponsabilidadesArea from "./ResponsabilidadesArea";
import "./Organigrama.css";

const PUEDE_EDITAR = ["admin", "admin_plus", "rh"];

/** ids de todo nodo cuya rama contiene una coincidencia (para expandirla al buscar). */
const idsConCoincidencia = (nodos, termino) => {
  const ids = new Set();
  const recorrer = (lista) => {
    let algunaCoincidencia = false;
    lista.forEach((n) => {
      let propia;
      if (n.tipo === "grupo") {
        propia = n.personas.some((p) => (p.name || "").toLowerCase().includes(termino));
      } else {
        propia = (n.persona.name || "").toLowerCase().includes(termino) || recorrer(n.hijos);
      }
      if (propia) { ids.add(n.id); algunaCoincidencia = true; }
    });
    return algunaCoincidencia;
  };
  recorrer(nodos);
  return ids;
};

/** ids de los primeros 2 niveles — con lo que arranca abierto el árbol. */
const idsPrimerosNiveles = (nodos) => {
  const ids = new Set();
  nodos.forEach((n) => {
    ids.add(n.id);
    if (n.tipo === "persona") (n.hijos || []).forEach((h) => ids.add(h.id));
  });
  return ids;
};

export default function Organigrama({ user }) {
  const { usuarios, areas, refreshAreas, refreshUsuarios } = useGlobal();
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);
  // null = todavía no tocó ningún +/-: arranca con los 2 primeros niveles abiertos (25+
  // nodos, abrir todo de entrada es una pared). Variable derivada y no un efecto que fija
  // el estado al montar (mismo patrón que GestionHorarios.jsx) — evita el parpadeo de
  // "árbol vacío" del primer render y el cascading-render de un setState en useEffect.
  const [expandidosManual, setExpandidosManual] = useState(null);
  const [mostrarDocs, setMostrarDocs] = useState(false);

  const puedeEditar = PUEDE_EDITAR.includes(user?.role);
  const arbol = useMemo(() => construirArbol(usuarios), [usuarios]);
  const expandidosPorDefecto = useMemo(() => idsPrimerosNiveles(arbol), [arbol]);
  const expandidosBase = expandidosManual ?? expandidosPorDefecto;

  const terminoBusqueda = busqueda.trim().toLowerCase();
  const coincidencias = useMemo(
    () => (terminoBusqueda ? idsConCoincidencia(arbol, terminoBusqueda) : null),
    [arbol, terminoBusqueda]
  );
  // Mientras se busca, se fuerzan abiertas las ramas con coincidencia SIN perder lo que el
  // usuario ya tenía abierto — así al borrar la búsqueda vuelve a como estaba.
  const expandidosEfectivos = coincidencias
    ? new Set([...expandidosBase, ...coincidencias])
    : expandidosBase;

  // A qué caja se mueve el mapa al buscar: la PRIMERA coincidencia. Sin esto, buscar a alguien
  // en un organigrama de ~100 personas abre su rama... en una parte del lienzo que no se está
  // mirando, y parece que el buscador no hace nada.
  const enfocarId = useMemo(() => {
    if (!coincidencias || coincidencias.size === 0) return null;
    const primera = (lista) => {
      for (const n of lista) {
        if (coincidencias.has(n.id)) {
          if (n.tipo === "grupo") return n.id;
          const propia = (n.persona.name || "").toLowerCase().includes(terminoBusqueda);
          if (propia) return n.id;
          const dentro = primera(n.hijos || []);
          if (dentro) return dentro;
          return n.id;
        }
      }
      return null;
    };
    return primera(arbol);
  }, [coincidencias, arbol, terminoBusqueda]);

  const alternar = (id) => {
    setExpandidosManual((prev) => {
      const base = prev ?? expandidosPorDefecto;
      const siguiente = new Set(base);
      if (siguiente.has(id)) siguiente.delete(id); else siguiente.add(id);
      return siguiente;
    });
  };

  // Al guardar un cambio de jefe/área desde el panel, refrescar usuarios trae el árbol al día
  // (misma fuente que ya usa el KPI del Dashboard Global).
  const alGuardarPersona = () => {
    refreshUsuarios?.();
    setSeleccionado((actual) => (actual ? usuarios.find((u) => u.id === actual.id) || actual : actual));
  };

  const areasOrdenadas = useMemo(() => [...areas].sort((a, b) => a.orden - b.orden), [areas]);

  return (
    <div className="admin-page organigrama-page">
      <PageHeader
        icon="users"
        eyebrow="McDental Pulse"
        title="Organigrama"
        subtitle="Quién reporta a quién, y las responsabilidades de cada departamento."
      >
        <button
          type="button"
          className="mc-btn-secondary"
          onClick={() => setMostrarDocs((v) => !v)}
        >
          <Icon name="fileDownload" size={16} />
          {mostrarDocs ? "Ver organigrama" : "Responsabilidades por depto."}
        </button>
      </PageHeader>

      {mostrarDocs ? (
        <div className="organigrama-areas-grid">
          {areasOrdenadas.length === 0 ? (
            <EmptyState icon="folder" message="Todavía no hay departamentos creados." />
          ) : (
            areasOrdenadas.map((area) => (
              <ResponsabilidadesArea
                key={area.id}
                area={area}
                puedeEditar={puedeEditar}
                usuarioId={user?.id}
                onCambio={refreshAreas}
              />
            ))
          )}
        </div>
      ) : (
        <div className="organigrama-layout">
          <Card className="organigrama-arbol-card">
            <div className="organigrama-buscador">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Buscar a alguien por nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            {arbol.length === 0 ? (
              <EmptyState icon="users" message="Todavía no hay nadie asignado en el organigrama." />
            ) : (
              <MapaOrganigrama
                arbol={arbol}
                expandidos={expandidosEfectivos}
                onToggle={alternar}
                onSeleccionar={setSeleccionado}
                seleccionadoId={seleccionado?.id}
                enfocarId={enfocarId}
                resaltados={coincidencias}
              />
            )}
          </Card>

          {seleccionado && (
            <PanelPersona
              persona={seleccionado}
              usuarios={usuarios}
              areas={areas}
              puedeEditar={puedeEditar}
              onCerrar={() => setSeleccionado(null)}
              onGuardado={alGuardarPersona}
            />
          )}
        </div>
      )}
    </div>
  );
}
