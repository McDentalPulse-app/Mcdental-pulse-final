/**
 * Dónde va cada caja del organigrama cuando se dibuja como MAPA y no como lista.
 *
 * Todo aquí es puro: entra el árbol (utils/organigrama/arbol.js) y el conjunto de nodos
 * expandidos, salen coordenadas. Sin React y sin DOM, que es lo único de este módulo que se
 * puede probar — y colocar cajas es justo el tipo de lógica que se ve "casi bien" y está mal.
 *
 * EL ALGORITMO, y su límite. Es un recorrido en profundidad con un cursor: las hojas se van
 * poniendo una detrás de otra, y cada padre se centra sobre sus hijos. Es el layout de árbol
 * "ordenado" clásico en su versión simple.
 *
 * ponytail: no implementa Reingold-Tilford completo (el que compacta subárboles vecinos
 * deslizándolos uno contra otro). Con la plantilla real —~100 personas y ramas cortas, porque
 * los hermanos con el mismo puesto se agrupan en UNA caja— el resultado es indistinguible y
 * cabe en un puñado de líneas. Si algún día el árbol se hace profundo y desequilibrado se verá
 * separación de más entre ramas hermanas; ese es el momento de cambiarlo, no antes.
 */

/** Medidas de una caja y de la separación entre ellas, en píxeles del lienzo (sin zoom). */
export const CAJA_ANCHO = 190;
export const CAJA_ALTO = 64;
export const SEPARACION_X = 28;
export const SEPARACION_Y = 58;

/** Margen alrededor del contenido, para que las cajas del borde no queden pegadas. */
export const MARGEN = 40;

/** ¿Qué hijos se dibujan? Solo los de un nodo persona que además esté expandido. */
const hijosVisibles = (nodo, expandidos) =>
  nodo.tipo === "persona" && expandidos.has(nodo.id) ? (nodo.hijos || []) : [];

/**
 * Coloca los nodos y devuelve un árbol con coordenadas.
 *
 * `ctx.cursor` es la siguiente X libre. Avanza SOLO al colocar una hoja: los padres no
 * consumen espacio propio, se centran sobre lo que ya ocuparon sus hijos. De ahí que dos
 * ramas nunca se pisen.
 */
const colocar = (nodos, nivel, expandidos, ctx) =>
  nodos.map((nodo) => {
    const hijos = hijosVisibles(nodo, expandidos);
    const y = nivel * (CAJA_ALTO + SEPARACION_Y);

    if (hijos.length === 0) {
      const x = ctx.cursor;
      ctx.cursor += CAJA_ANCHO + SEPARACION_X;
      return { nodo, x, y, nivel, hijos: [] };
    }

    const colocados = colocar(hijos, nivel + 1, expandidos, ctx);
    // Centrado sobre el PRIMERO y el ÚLTIMO, no sobre el promedio de todos: con hijos de
    // anchos distintos el promedio desplaza al padre hacia el lado que tenga más ramas.
    const x = (colocados[0].x + colocados[colocados.length - 1].x) / 2;
    return { nodo, x, y, nivel, hijos: colocados };
  });

/** Recorre el árbol ya colocado y saca las listas planas que la pantalla necesita pintar. */
const aplanarColocados = (colocados, cajas, enlaces) => {
  colocados.forEach((c) => {
    cajas.push({ id: c.nodo.id, nodo: c.nodo, x: c.x, y: c.y, nivel: c.nivel });
    c.hijos.forEach((h) => {
      enlaces.push({
        id: `${c.nodo.id}->${h.nodo.id}`,
        // Del borde inferior del padre al borde superior del hijo, ambos centrados.
        x1: c.x + CAJA_ANCHO / 2,
        y1: c.y + CAJA_ALTO,
        x2: h.x + CAJA_ANCHO / 2,
        y2: h.y,
      });
    });
    aplanarColocados(c.hijos, cajas, enlaces);
  });
};

/**
 * El mapa completo: cajas con su posición, enlaces padre→hijo y el tamaño del lienzo.
 *
 * Las coordenadas salen ya desplazadas por `MARGEN`, así que la caja más a la izquierda no
 * queda pegada al borde y las líneas no se cortan.
 */
export const calcularLayout = (arbol = [], expandidos = new Set()) => {
  if (!arbol.length) return { cajas: [], enlaces: [], ancho: 0, alto: 0 };

  const ctx = { cursor: 0 };
  const colocados = colocar(arbol, 0, expandidos, ctx);

  const cajas = [];
  const enlaces = [];
  aplanarColocados(colocados, cajas, enlaces);

  // Un padre centrado puede quedar a la IZQUIERDA de la primera hoja (x negativa) cuando su
  // única rama arranca en 0. Se mide el mínimo real en vez de asumir que es 0, o esa caja se
  // dibujaría fuera del lienzo y el scroll no llegaría hasta ella.
  const minX = Math.min(...cajas.map((c) => c.x));
  const maxX = Math.max(...cajas.map((c) => c.x));
  const maxY = Math.max(...cajas.map((c) => c.y));
  const desplazamiento = MARGEN - minX;

  cajas.forEach((c) => { c.x += desplazamiento; });
  enlaces.forEach((e) => { e.x1 += desplazamiento; e.x2 += desplazamiento; });

  return {
    cajas,
    enlaces,
    ancho: maxX - minX + CAJA_ANCHO + MARGEN * 2,
    alto: maxY + CAJA_ALTO + MARGEN * 2,
  };
};

/** La caja de una persona concreta, para poder centrar el mapa en ella al buscarla. */
export const cajaDePersona = (cajas = [], personaId) =>
  cajas.find((c) =>
    c.nodo.tipo === "persona"
      ? c.nodo.persona.id === personaId
      : (c.nodo.personas || []).some((p) => p.id === personaId)
  ) || null;
