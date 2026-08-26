// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { useEffect, useRef, useState } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Select from "./Select";

/**
 * Las PRIMERAS pruebas de esta app que tocan el DOM.
 *
 * POR QUÉ EMPIEZAN AQUÍ. Las otras 556 son de utilidades puras, y por eso no vieron ninguno de
 * los dos fallos que el dueño encontró él mismo el 6 de agosto de 2026: el filtro de Sucursal del
 * panel de Asistencia había dejado de funcionar por completo, y un botón salía sin estilar. Los
 * dos eran de interacción y maquetado, invisibles para un test de función pura. Este archivo
 * cubre el primero, que es el que dejó una pantalla inservible.
 *
 * `@vitest-environment jsdom` va en el docblock y no en la configuración a propósito: así las 556
 * existentes siguen corriendo en Node, que es mucho más rápido, y solo paga jsdom quien lo pide.
 */

afterEach(cleanup);

// jsdom no implementa scrollIntoView, y el Select lo usa para mantener a la vista la opción
// resaltada mientras se navega con el teclado. Es una carencia del ENTORNO, no del componente:
// sin este relleno, cualquier prueba que abra la lista revienta con «no es una función».
window.HTMLElement.prototype.scrollIntoView = vi.fn();

/**
 * Reproduce la forma exacta que rompió: un <Select> dentro de un panel que se cierra con
 * cualquier `mousedown` fuera de su `ref` — el patrón de «Filtros» en AsistenciaPanel.
 *
 * La lista del Select se dibuja en un PORTAL a <body>, así que un clic en una opción cae FUERA del
 * `ref` del panel. Sin la exclusión, ese `mousedown` cerraba el panel, el Select se desmontaba, y
 * el `click` nunca llegaba al `onClick` de la opción: elegir una sucursal no hacía absolutamente
 * nada. El `guardaContraPortal` de abajo es la corrección; ponerlo en `false` hace fallar la
 * prueba, que es lo que demuestra que la prueba sirve.
 */
function PanelConFiltro({ onChange, guardaContraPortal = true }) {
  const [abierto, setAbierto] = useState(true);
  const [valor, setValor] = useState("Todas");
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const alClic = (e) => {
      if (guardaContraPortal && e.target?.closest?.(".mc-select-menu")) return;
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, [abierto, guardaContraPortal]);

  return (
    <div ref={ref} data-testid="panel">
      {abierto && (
        <Select
          value={valor}
          onChange={(v) => { setValor(v); onChange(v); }}
        >
          <option value="Todas">Todas las sucursales</option>
          <option value="McDental Palmas">McDental Palmas</option>
          <option value="McDental Tampico">McDental Tampico</option>
        </Select>
      )}
    </div>
  );
}

describe("Select", () => {
  it("la lista se dibuja fuera del componente, en un portal a <body>", async () => {
    // Es la razón de ser del fallo: si algún día deja de ir en un portal, la recortaría el
    // primer ancestro con overflow:hidden y volveríamos al desplegable cortado a dos renglones.
    const { container } = render(<Select value="a"><option value="a">A</option></Select>);
    await userEvent.click(screen.getByRole("button"));
    const menu = document.querySelector(".mc-select-menu");
    expect(menu).not.toBeNull();
    expect(container.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
  });

  it("elegir una opción avisa con su valor y cierra la lista", async () => {
    const onChange = vi.fn();
    render(
      <Select value="Todas" onChange={onChange}>
        <option value="Todas">Todas</option>
        <option value="McDental Palmas">McDental Palmas</option>
      </Select>
    );
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("option", { name: "McDental Palmas" }));
    expect(onChange).toHaveBeenCalledWith("McDental Palmas");
    expect(document.querySelector(".mc-select-menu")).toBeNull();
  });

  it("no avisa de una opción deshabilitada", async () => {
    const onChange = vi.fn();
    render(
      <Select value="a" onChange={onChange}>
        <option value="a">A</option>
        <option value="b" disabled>B</option>
      </Select>
    );
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("option", { name: "B" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("REGRESIÓN: Select dentro de un panel que se cierra al clic fuera", () => {
  it("elegir una sucursal SÍ cambia el filtro", async () => {
    // El fallo del 6-ago: esto no hacía nada. El panel se cerraba y el filtro se quedaba en
    // «Todas» para siempre.
    const onChange = vi.fn();
    render(<PanelConFiltro onChange={onChange} />);

    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("option", { name: "McDental Palmas" }));

    expect(onChange).toHaveBeenCalledWith("McDental Palmas");
    // Y el panel sigue en pie: el clic en la opción no cuenta como «clic fuera».
    expect(screen.getByTestId("panel")).toBeTruthy();
  });

  it("sin la exclusión del portal, el mismo clic se pierde (el fallo, reproducido)", async () => {
    // Esta prueba existe para demostrar que la de arriba no pasa por casualidad. Con
    // `guardaContraPortal` en false se recrea el código roto, y el clic no llega nunca.
    const onChange = vi.fn();
    render(<PanelConFiltro onChange={onChange} guardaContraPortal={false} />);

    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("option", { name: "McDental Palmas" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("un clic de verdad fuera sí cierra el panel", async () => {
    // La exclusión no puede pasarse de lista: el panel tiene que seguir cerrándose.
    render(<PanelConFiltro onChange={() => {}} />);
    expect(screen.getByRole("button")).toBeTruthy();
    await userEvent.click(document.body);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
