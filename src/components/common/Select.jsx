import { useState, useRef, useEffect, useMemo, useId, useCallback, Children } from "react";
import { createPortal } from "react-dom";
import Icon from "../ui/Icon";

/**
 * Desplegable PROPIO, para sustituir a `<select>` en los formularios.
 *
 * Existe porque la lista que abre un `<select>` nativo NO se puede maquetar: el navegador la
 * dibuja con el estilo del sistema operativo, y ningún CSS la alcanza. Daba igual que la caja
 * cerrada estuviera perfectamente igualada con los demás campos — al pulsarla salía una lista
 * gris apretada, con el resaltado azul de Windows, encima de una app oscura.
 *
 * Cerrado se ve como cualquier otro campo (misma caja, mismos tokens `--mc-control-*`).
 * Abierto se ve como el popover de <WeekSelect>, que es el que ya se usaba en la cabecera.
 * Las dos mitades comparten declaraciones en App.css, así que no pueden separarse por copiar
 * mal un valor.
 *
 * ACEPTA LOS MISMOS `<option>` COMO HIJOS que un `<select>`, además de un `options` normal.
 * No es un capricho de API: los treinta `<select>` que sustituye construyen sus opciones de
 * treinta maneras (listas fijas, `.map()` sobre empleados, `Set` de sucursales, filtros por
 * activo…). Reescribir esa lógica treinta veces es treinta oportunidades de equivocarse en algo
 * que hoy funciona; aceptando los hijos, la conversión es cambiar la etiqueta y nada más.
 *
 * Accesible a teclado a propósito: un `<select>` nativo se maneja sin ratón y perder eso al
 * cambiarlo sería un retroceso. Flechas mueven, Enter elige, Escape cierra, Inicio/Fin saltan
 * a los extremos, y escribir letras salta a la opción que empieza así.
 */
const normaliza = (o) =>
  typeof o === "string" || typeof o === "number"
    ? { value: o, label: String(o) }
    : { value: o.value, label: o.label ?? String(o.value), disabled: !!o.disabled };

/** Las opciones que vengan como hijos `<option>`, aplanando los `.map()`. */
const desdeHijos = (children) =>
  Children.toArray(children)
    .filter((c) => c?.props)
    .map((c) => ({
      value: c.props.value ?? c.props.children,
      label: Array.isArray(c.props.children) ? c.props.children.join("") : c.props.children,
      disabled: !!c.props.disabled,
    }));

const Select = ({
  value,
  options,
  onChange,
  children,
  placeholder = "Selecciona…",
  disabled = false,
  id,
  name,
  className = "",
  "aria-label": ariaLabel,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);
  const ref = useRef(null);
  const listaRef = useRef(null);
  const teclado = useRef({ texto: "", t: 0 });
  const idAuto = useId();
  const idLista = `${id || idAuto}-lista`;
  const [pos, setPos] = useState(null);

  const opciones = useMemo(
    () => (options ? options.map(normaliza) : desdeHijos(children)),
    [options, children]
  );
  const indiceActual = opciones.findIndex((o) => String(o.value) === String(value));
  const actual = indiceActual >= 0 ? opciones[indiceActual] : null;

  /**
   * Dónde cae el popover, en coordenadas de PANTALLA.
   *
   * Se calcula a mano porque la lista va en un portal a <body>: dentro del componente la
   * recortaría el primer ancestro con `overflow: hidden`, y en esta app hay 81 reglas que
   * recortan — `.mc-card`, la primera. Un desplegable dentro de una tarjeta salía cortado a
   * los dos renglones. Es el mismo motivo por el que FotoAmpliada y el detalle de sucursal
   * viven también en un portal.
   *
   * Si no cabe por debajo, se abre hacia ARRIBA en vez de salirse de la pantalla.
   */
  const situar = useCallback(() => {
    const t = ref.current?.getBoundingClientRect();
    if (!t) return;
    const ALTO_MAX = 320, AIRE = 6;
    // En el teléfono hay una barra de navegación flotante sobre el contenido. Se mide en vez de
    // suponerla: así el cálculo sigue siendo correcto si cambia de alto o si no está.
    const barra = document.querySelector(".mobile-tabbar");
    const suelo = barra ? window.innerHeight - barra.getBoundingClientRect().top + AIRE : 0;
    const debajo = window.innerHeight - t.bottom - AIRE - suelo;
    const encima = t.top - AIRE;
    const haciaArriba = debajo < 180 && encima > debajo;
    // El popover puede crecer más que el campo (etiquetas largas), y si el campo está escorado a
    // la derecha eso lo sacaría de la pantalla. Se le da como tope lo que queda hasta el borde,
    // que nunca es menor que el propio campo porque el campo ya cabe.
    const anchoMax = Math.max(t.width, window.innerWidth - t.left - 8);
    setPos({
      left: t.left,
      width: t.width,
      maxWidth: anchoMax,
      // SE FIJAN LOS DOS, `top` y `bottom`, siempre. Fijar solo uno deja vivo el otro, y la
      // regla base que se comparte con <WeekSelect> trae `top: calc(100% + 6px)`: en un
      // elemento `fixed` ese 100% es el alto de la PANTALLA, así que al abrir hacia arriba el
      // menú se iba a 100vh + 6px — fuera de la vista por abajo, con la altura colapsada.
      //
      // No era un caso raro: pasaba en cuanto el campo quedaba cerca del pie. Por eso "Rol"
      // funcionaba y "Sucursal" no en la misma ventana — el segundo está más abajo.
      ...(haciaArriba
        ? { top: "auto", bottom: window.innerHeight - t.top + AIRE, maxHeight: Math.min(ALTO_MAX, encima) }
        : { top: t.bottom + AIRE, bottom: "auto", maxHeight: Math.min(ALTO_MAX, debajo) }),
    });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    situar();
    const fuera = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (listaRef.current?.contains(e.target)) return;   // el menú ya no está dentro de `ref`
      setAbierto(false);
    };
    // `true` para enterarse también del scroll de los contenedores internos, no solo de la
    // ventana: si no, el menú se queda flotando donde estaba mientras la tabla se desplaza.
    document.addEventListener("mousedown", fuera);
    window.addEventListener("scroll", situar, true);
    window.addEventListener("resize", situar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("scroll", situar, true);
      window.removeEventListener("resize", situar);
    };
  }, [abierto, situar]);

  // Al abrir, el recorrido arranca en la opción YA elegida: si empezara desde arriba, en una
  // lista de 26 sucursales habría que bajar veinte veces para llegar a la que ya estaba puesta.
  // Se hace aquí y no en un efecto porque abrir es un evento, no una consecuencia del estado.
  const abrir = () => {
    setResaltado(indiceActual >= 0 ? indiceActual : 0);
    setAbierto(true);
  };

  // Mantiene a la vista la opción resaltada mientras se navega con el teclado.
  useEffect(() => {
    if (!abierto || resaltado < 0) return;
    listaRef.current?.children[resaltado]?.scrollIntoView({ block: "nearest" });
  }, [abierto, resaltado]);

  const elegir = (o) => {
    if (o.disabled) return;
    onChange?.(o.value);
    setAbierto(false);
  };

  const mover = (paso) => {
    if (!opciones.length) return;
    let i = resaltado;
    for (let n = 0; n < opciones.length; n++) {
      i = (i + paso + opciones.length) % opciones.length;
      if (!opciones[i].disabled) break;
    }
    setResaltado(i);
  };

  const alTeclear = (e) => {
    if (disabled) return;
    const k = e.key;

    if (!abierto && (k === "Enter" || k === " " || k === "ArrowDown" || k === "ArrowUp")) {
      e.preventDefault(); abrir(); return;
    }
    if (!abierto) return;

    if (k === "Escape") { e.preventDefault(); setAbierto(false); return; }
    if (k === "ArrowDown") { e.preventDefault(); mover(1); return; }
    if (k === "ArrowUp") { e.preventDefault(); mover(-1); return; }
    if (k === "Home") { e.preventDefault(); setResaltado(0); return; }
    if (k === "End") { e.preventDefault(); setResaltado(opciones.length - 1); return; }
    if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (opciones[resaltado]) elegir(opciones[resaltado]);
      return;
    }

    // Escribir para buscar, como en un select nativo. Las letras se acumulan si van seguidas:
    // "hermo" salta a Hermosillo en vez de quedarse en la primera que empieza por O.
    if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ahora = Date.now();
      teclado.current.texto = ahora - teclado.current.t > 700 ? k : teclado.current.texto + k;
      teclado.current.t = ahora;
      const buscado = teclado.current.texto.toLowerCase();
      const i = opciones.findIndex((o) => o.label.toLowerCase().startsWith(buscado));
      if (i >= 0) setResaltado(i);
    }
  };

  return (
    <div className={`mc-select${className ? ` ${className}` : ""}`} ref={ref}>
      <button
        type="button"
        id={id}
        className={`mc-select-trigger${abierto ? " mc-select-trigger--abierto" : ""}`}
        onClick={() => { if (disabled) return; abierto ? setAbierto(false) : abrir(); }}
        onKeyDown={alTeclear}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-label={ariaLabel}
      >
        <span className={`mc-select-valor${actual ? "" : " mc-select-valor--vacio"}`}>
          {actual ? actual.label : placeholder}
        </span>
        <Icon name="chevronDown" size={16} className="mc-select-caret" />
      </button>

      {/* Un `<select>` con `name` lo recoge FormData al enviar el formulario; un botón no. Este
          campo oculto conserva ese comportamiento, para no tener que reescribir los formularios
          que leen sus datos así.

          SIN `required`: un campo oculto obligatorio es infocusable, y el navegador aborta el
          envío con "An invalid form control is not focusable" sin decir nada al usuario. Los dos
          formularios que lo usaban ya validaban por su cuenta en JavaScript. */}
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {abierto && pos && createPortal(
        <ul
          className="mc-select-menu"
          role="listbox"
          id={idLista}
          ref={listaRef}
          style={{ ...pos, minWidth: pos.width, width: undefined }}
        >
          {opciones.map((o, i) => (
            <li key={String(o.value)}>
              <button
                type="button"
                role="option"
                aria-selected={String(o.value) === String(value)}
                disabled={o.disabled}
                className={`mc-select-option${String(o.value) === String(value) ? " mc-select-option--activa" : ""}${i === resaltado ? " mc-select-option--resaltada" : ""}`}
                onClick={() => elegir(o)}
                onMouseEnter={() => setResaltado(i)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
};

export default Select;
