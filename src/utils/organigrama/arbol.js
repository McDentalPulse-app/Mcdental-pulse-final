/**
 * De una lista plana de usuarios a un árbol de organigrama.
 *
 * Sin tabla de nodos: el árbol se arma en memoria a partir de `jefeId` (mig. 153). Los
 * "hermanos" con el mismo `puesto` (2 o más) se pintan como una caja de grupo — "Dentistas",
 * "Recepcionistas" — en vez de repetir 50 cajas idénticas. El conteo de cada grupo nunca se
 * desfasa de la plantilla real porque no se guarda en ningún lado: es la cuenta de cuántos
 * llegaron acá adentro.
 *
 * Los `inactivo = true` (de baja temporal) SÍ entran al árbol — se pintan distinto, no
 * desaparecen (decisión del dueño, plan-organigrama.md §9-P4). Los `archivado = true` no
 * entran: ya no son personal vigente.
 */

/** "Recepcionista", " recepcionista ", "RECEPCIONISTA" -> misma clave de grupo. */
const normalizarPuesto = (puesto) => (puesto || "").trim().toLowerCase();

/** La grafía que más se repite dentro del grupo, para no mostrar una al azar. */
const grafiaMasFrecuente = (personas) => {
  const conteo = new Map();
  personas.forEach((p) => {
    const raw = (p.puesto || "").trim();
    conteo.set(raw, (conteo.get(raw) || 0) + 1);
  });
  let mejor = personas[0]?.puesto || "";
  let max = 0;
  conteo.forEach((n, raw) => {
    if (n > max) { max = n; mejor = raw; }
  });
  return mejor;
};

const puestoDe = (nodo) => (nodo.tipo === "grupo" ? nodo.puesto : (nodo.persona.puesto || ""));
const nombreDe = (nodo) => (nodo.tipo === "grupo" ? "" : (nodo.persona.name || ""));

/** Por puesto y luego por nombre — el orden manual dentro de una rama no se pidió (§9-P5). */
const ordenarNodos = (nodos) =>
  [...nodos].sort((a, b) => {
    const porPuesto = puestoDe(a).localeCompare(puestoDe(b));
    return porPuesto !== 0 ? porPuesto : nombreDe(a).localeCompare(nombreDe(b));
  });

export const construirArbol = (usuarios = []) => {
  const vigentes = usuarios.filter((u) => u && u.id && !u.archivado);
  const porId = new Set(vigentes.map((u) => u.id));

  const hijosPorJefe = new Map();
  const raices = [];
  vigentes.forEach((u) => {
    if (u.jefeId && porId.has(u.jefeId)) {
      if (!hijosPorJefe.has(u.jefeId)) hijosPorJefe.set(u.jefeId, []);
      hijosPorJefe.get(u.jefeId).push(u);
    } else {
      raices.push(u);
    }
  });

  // El trigger de la mig. 153 impide guardar un ciclo — esto es la segunda línea, por si
  // algún día llega un dato viejo o tocado a mano por fuera de la app. Sin esto, dos personas
  // atrapadas entre sí (A→B, B→A) no cuelgan el render, pero SÍ desaparecen del árbol sin
  // avisar — peor que mostrarlas sueltas para que alguien las reasigne.
  const alcanzables = new Set();
  const marcarAlcanzables = (id, enEsteCamino) => {
    if (alcanzables.has(id) || enEsteCamino.has(id)) return;
    enEsteCamino.add(id);
    alcanzables.add(id);
    (hijosPorJefe.get(id) || []).forEach((h) => marcarAlcanzables(h.id, enEsteCamino));
  };
  raices.forEach((r) => marcarAlcanzables(r.id, new Set()));

  const atrapadosEnCiclo = vigentes.filter((u) => !alcanzables.has(u.id));
  const todasLasRaices = [...raices, ...atrapadosEnCiclo];

  // Defensa de cliente: si por lo que sea se coló un ciclo (el trigger de la mig. 153 ya lo
  // impide en la base, esto es la segunda línea), una persona ya pintada no se vuelve a bajar.
  const visitados = new Set();

  const nodosDe = (personas) => {
    const grupos = new Map();
    const ordenGrupos = [];
    personas.forEach((p) => {
      const clave = normalizarPuesto(p.puesto);
      if (!grupos.has(clave)) { grupos.set(clave, []); ordenGrupos.push(clave); }
      grupos.get(clave).push(p);
    });

    const nodos = [];
    ordenGrupos.forEach((clave) => {
      const miembros = grupos.get(clave);
      if (miembros.length >= 2) {
        nodos.push({
          tipo: "grupo",
          id: `grupo:${miembros[0].jefeId || "raiz"}:${clave || "sin-puesto"}`,
          puesto: grafiaMasFrecuente(miembros),
          personas: miembros,
        });
        return;
      }
      const persona = miembros[0];
      if (visitados.has(persona.id)) return;
      visitados.add(persona.id);
      nodos.push({
        tipo: "persona",
        id: persona.id,
        persona,
        hijos: nodosDe(hijosPorJefe.get(persona.id) || []),
      });
    });

    return ordenarNodos(nodos);
  };

  return nodosDe(todasLasRaices);
};

/** Todas las personas (sin agrupar) que cuelgan de un nodo, para el buscador y el detalle. */
export const aplanar = (nodos) =>
  nodos.flatMap((n) =>
    n.tipo === "grupo" ? n.personas : [n.persona, ...aplanar(n.hijos)]
  );
