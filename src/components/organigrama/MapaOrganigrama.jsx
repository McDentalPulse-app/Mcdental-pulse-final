import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { calcularLayout, CAJA_ANCHO, CAJA_ALTO } from "../../utils/organigrama/layout";

/**
 * El organigrama como MAPA: se arrastra y se hace zoom, en vez de leerse como una lista.
 *
 * POR QUÉ ASÍ. La versión anterior era una lista con sangría, y su comentario explicaba el
 * motivo: un diagrama ancho de cajas y líneas no cabe en un teléfono. Es cierto — pero un mapa
 * NO NECESITA CABER. Google Maps tampoco cabe: se arrastra y se acerca. Al convertirlo en un
 * lienzo navegable, la objeción que obligaba a la lista desaparece, y en el teléfono se maneja
 * con los mismos gestos que cualquier mapa (un dedo mueve, dos pellizcan).
 *
 * Las posiciones NO se calculan aquí: salen de utils/organigrama/layout.js, que es puro y está
 * probado. Este componente solo pinta y gestiona los gestos.
 *
 * Sobre los estilos en línea: DESIGN.md los prohíbe para color, fondo, borde y sombra —rompen
 * el modo oscuro— y los permite para "layout dinámico calculado". Aquí solo se usan para
 * `transform`, `left`/`top` y el tamaño del lienzo, que es exactamente ese caso: son números
 * que salen del cálculo, no decisiones visuales.
 */

const ESCALA_MIN = 0.35;
const ESCALA_MAX = 1.8;
const PASO_BOTON = 1.25;

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Distancia entre dos punteros, para el pellizco. */
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export default function MapaOrganigrama({
  arbol,
  expandidos,
  onToggle,
  onSeleccionar,
  seleccionadoId,
  enfocarId = null,
  resaltados = null,
}) {
  const viewportRef = useRef(null);
  const [vista, setVista] = useState({ x: 0, y: 0, escala: 1 });
  const [arrastrando, setArrastrando] = useState(false);

  const { cajas, enlaces, ancho, alto } = useMemo(
    () => calcularLayout(arbol, expandidos),
    [arbol, expandidos]
  );

  // Punteros activos: uno = arrastrar, dos = pellizcar. Va en un ref y no en estado porque
  // cambia en cada pointermove y no debe repintar por sí mismo.
  const punteros = useRef(new Map());
  const gesto = useRef(null);

  /** Encaja todo el contenido en la ventana visible. Es también el botón de "centrar". */
  const encajar = useCallback(() => {
    const caja = viewportRef.current?.getBoundingClientRect();
    if (!caja || !ancho || !alto) return;
    const escala = limitar(Math.min(caja.width / ancho, caja.height / alto), ESCALA_MIN, 1);
    setVista({
      escala,
      x: (caja.width - ancho * escala) / 2,
      y: (caja.height - alto * escala) / 2,
    });
  }, [ancho, alto]);

  // Al montar (y cuando cambia el tamaño del árbol) se encaja una vez. useLayoutEffect y no
  // useEffect: así la primera pintura ya sale centrada, sin el salto de verla arriba a la
  // izquierda y que se recoloque después.
  const yaEncajado = useRef(false);
  useLayoutEffect(() => {
    if (yaEncajado.current || !cajas.length) return;
    yaEncajado.current = true;
    encajar();
  }, [cajas.length, encajar]);

  /** Zoom manteniendo fijo un punto de la pantalla (el cursor, o el centro del pellizco). */
  const zoomEn = useCallback((factor, puntoX, puntoY) => {
    setVista((v) => {
      const escala = limitar(v.escala * factor, ESCALA_MIN, ESCALA_MAX);
      const real = escala / v.escala; // el factor que de verdad se aplicó, tras el recorte
      return {
        escala,
        x: puntoX - (puntoX - v.x) * real,
        y: puntoY - (puntoY - v.y) * real,
      };
    });
  }, []);

  const zoomBoton = (factor) => {
    const caja = viewportRef.current?.getBoundingClientRect();
    if (!caja) return;
    zoomEn(factor, caja.width / 2, caja.height / 2);
  };

  // La rueda se escucha a mano y no con onWheel: React lo registra como pasivo, y un listener
  // pasivo no puede llamar a preventDefault() — sin eso, hacer zoom sobre el mapa desplaza la
  // página entera por debajo.
  useEffect(() => {
    const nodo = viewportRef.current;
    if (!nodo) return undefined;
    const alRodar = (e) => {
      e.preventDefault();
      const caja = nodo.getBoundingClientRect();
      zoomEn(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - caja.left, e.clientY - caja.top);
    };
    nodo.addEventListener("wheel", alRodar, { passive: false });
    return () => nodo.removeEventListener("wheel", alRodar);
  }, [zoomEn]);

  const alBajarPuntero = (e) => {
    // Un clic en una caja o en un botón NO arrastra el mapa: si no, seleccionar a alguien
    // movería el lienzo unos píxeles y el clic se sentiría "resbaladizo".
    if (e.target.closest("button")) return;

    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);

    if (punteros.current.size === 1) {
      gesto.current = { tipo: "arrastre", x: e.clientX, y: e.clientY };
      setArrastrando(true);
    } else if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      gesto.current = { tipo: "pellizco", inicial: distancia(a, b) };
      setArrastrando(false);
    }
  };

  const alMoverPuntero = (e) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesto.current?.tipo === "arrastre") {
      const dx = e.clientX - gesto.current.x;
      const dy = e.clientY - gesto.current.y;
      gesto.current = { tipo: "arrastre", x: e.clientX, y: e.clientY };
      setVista((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }

    if (gesto.current?.tipo === "pellizco" && punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      const ahora = distancia(a, b);
      if (!gesto.current.inicial) return;
      const caja = viewportRef.current.getBoundingClientRect();
      zoomEn(
        ahora / gesto.current.inicial,
        (a.x + b.x) / 2 - caja.left,
        (a.y + b.y) / 2 - caja.top
      );
      gesto.current = { tipo: "pellizco", inicial: ahora };
    }
  };

  const alSoltarPuntero = (e) => {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size === 0) {
      gesto.current = null;
      setArrastrando(false);
    } else if (punteros.current.size === 1) {
      // Al levantar un dedo del pellizco, el que queda pasa a arrastrar sin dar un salto.
      const [q] = [...punteros.current.values()];
      gesto.current = { tipo: "arrastre", x: q.x, y: q.y };
      setArrastrando(true);
    }
  };

  // Centrar en una caja concreta (lo usa el buscador). Se mantiene el zoom actual: cambiarlo
  // además de moverse desorienta, porque se pierde la referencia de dónde estabas.
  useEffect(() => {
    if (!enfocarId) return;
    const caja = cajas.find((c) => c.id === enfocarId);
    const marco = viewportRef.current?.getBoundingClientRect();
    if (!caja || !marco) return;
    setVista((v) => ({
      ...v,
      x: marco.width / 2 - (caja.x + CAJA_ANCHO / 2) * v.escala,
      y: marco.height / 2 - (caja.y + CAJA_ALTO / 2) * v.escala,
    }));
  }, [enfocarId, cajas]);

  return (
    <div className="organigrama-mapa-wrap">
      <div
        ref={viewportRef}
        className={`organigrama-mapa${arrastrando ? " organigrama-mapa--arrastrando" : ""}`}
        onPointerDown={alBajarPuntero}
        onPointerMove={alMoverPuntero}
        onPointerUp={alSoltarPuntero}
        onPointerCancel={alSoltarPuntero}
      >
        <div
          className="organigrama-lienzo"
          style={{
            width: ancho,
            height: alto,
            transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`,
          }}
        >
          <svg className="organigrama-enlaces" width={ancho} height={alto} aria-hidden="true">
            {enlaces.map((e) => {
              const medio = (e.y1 + e.y2) / 2;
              return (
                <path
                  key={e.id}
                  className="organigrama-enlace"
                  d={`M ${e.x1} ${e.y1} V ${medio} H ${e.x2} V ${e.y2}`}
                />
              );
            })}
          </svg>

          {cajas.map((c) => {
            const esGrupo = c.nodo.tipo === "grupo";
            const persona = esGrupo ? null : c.nodo.persona;
            const tieneHijos = !esGrupo && (c.nodo.hijos || []).length > 0;
            const abierto = expandidos.has(c.id);
            const activa = !esGrupo && seleccionadoId === persona.id;
            const resaltada = resaltados ? resaltados.has(c.id) : false;

            return (
              <div
                key={c.id}
                className={`organigrama-caja${esGrupo ? " organigrama-caja--grupo" : ""}${
                  persona?.inactivo ? " organigrama-caja--inactivo" : ""
                }${activa ? " organigrama-caja--activa" : ""}${
                  resaltada ? " organigrama-caja--resaltada" : ""
                }`}
                style={{ left: c.x, top: c.y, width: CAJA_ANCHO, height: CAJA_ALTO }}
              >
                <button
                  type="button"
                  className="organigrama-caja-cuerpo"
                  onClick={() => (esGrupo ? onToggle(c.id) : onSeleccionar(persona))}
                  title={esGrupo ? `${c.nodo.puesto} · ${c.nodo.personas.length}` : persona.name}
                >
                  <span className="organigrama-nombre">
                    {esGrupo ? c.nodo.puesto || "Sin puesto" : persona.name}
                  </span>
                  <span className="organigrama-puesto">
                    {esGrupo ? `${c.nodo.personas.length} personas` : persona.puesto || ""}
                  </span>
                  {persona?.inactivo && (
                    <span className="organigrama-etiqueta-inactivo">De baja</span>
                  )}
                </button>

                {tieneHijos && (
                  <button
                    type="button"
                    className="organigrama-toggle"
                    onClick={() => onToggle(c.id)}
                    aria-label={abierto ? "Colapsar rama" : "Expandir rama"}
                    aria-expanded={abierto}
                    title={abierto ? "Colapsar" : `Ver ${c.nodo.hijos.length} debajo`}
                  >
                    <Icon name={abierto ? "minus" : "plus"} size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="organigrama-controles">
          <button type="button" className="organigrama-control" onClick={() => zoomBoton(PASO_BOTON)} aria-label="Acercar">
            <Icon name="plus" size={16} />
          </button>
          <button type="button" className="organigrama-control" onClick={() => zoomBoton(1 / PASO_BOTON)} aria-label="Alejar">
            <Icon name="minus" size={16} />
          </button>
          <button type="button" className="organigrama-control" onClick={encajar} aria-label="Centrar el mapa">
            <Icon name="home" size={16} />
          </button>
        </div>
      </div>

      <p className="organigrama-ayuda-mapa">
        Arrastra para moverte · rueda o dos dedos para el zoom · toca una caja para ver a la persona
      </p>
    </div>
  );
}
