// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * El panel de Asistencia DE VERDAD, no un harness que imite su forma.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE. `Select.dom.test.jsx` reproduce el PATRÓN que rompió el 6 de agosto
 * de 2026 (un desplegable en portal dentro de un panel que se cierra al clic fuera), y eso deja un
 * hueco honesto: si alguien cambia el manejador de clic-fuera DE ESTE archivo, aquella prueba sigue
 * en verde. Esta monta el componente real, con su propio manejador, su propio Select y su propio
 * estado de filtro.
 *
 * LO QUE SE SIMULA Y LO QUE NO. Solo las tres puertas de datos: el servicio de asistencias, el
 * contexto global (de donde salen los nombres de sucursal) y el de notificaciones. `usuarios`,
 * `horarios`, `permisos` y `vacaciones` entran por props, así que van de verdad — y con ellos va de
 * verdad `construirDias`, que es quien decide falta/retardo/descanso. No se simula nada de la
 * lógica que se está probando.
 */

const getAsistencias = vi.fn();
const subscribeAsistencias = vi.fn();
const anularChecada = vi.fn();

vi.mock("../../services/supabase/asistenciasService", () => ({
  getAsistencias: (...a) => getAsistencias(...a),
  subscribeAsistencias: (...a) => subscribeAsistencias(...a),
  anularChecada: (...a) => anularChecada(...a),
}));

vi.mock("../../contexts/GlobalContext", () => ({
  useGlobal: () => ({
    nombresSucursales: ["McDental Palmas", "McDental Tampico"],
    sucursales: [
      { id: "s1", nombre: "McDental Palmas", activa: true, zonaHoraria: "America/Monterrey" },
      { id: "s2", nombre: "McDental Tampico", activa: true, zonaHoraria: "America/Monterrey" },
    ],
  }),
}));

vi.mock("../../contexts/NotificationContext", () => ({
  useNotification: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    prompt: vi.fn(),
    confirm: vi.fn(),
  }),
}));

// jsdom no implementa scrollIntoView y el Select lo usa para mantener a la vista la opción
// resaltada. Carencia del entorno, no del componente.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const AsistenciaPanel = (await import("./AsistenciaPanel")).default;

const USUARIOS = [
  { id: "u1", name: "JUANA GARAY", sucursal: "McDental Palmas", role: "doctor", inactivo: false },
  { id: "u2", name: "VALERIA ALCARAZ", sucursal: "McDental Palmas", role: "doctor", inactivo: false },
  { id: "u3", name: "PERLA CRUZ", sucursal: "McDental Tampico", role: "empleado", inactivo: false },
];

/** Los nombres de la lista de empleados, en orden. */
const nombresListados = () =>
  [...document.querySelectorAll(".asistencia-emp-item-nombre")].map((n) => n.textContent.trim());

/**
 * Espera a que la lista esté pintada.
 *
 * No se usa `findByText(nombre)`: el nombre del empleado seleccionado aparece DOS veces —en la
 * lista de la izquierda y en la cabecera de su calendario a la derecha— así que la consulta por
 * texto falla con «found multiple elements». Se espera por lo que de verdad se va a comprobar.
 */
const esperarLista = (cuantos) =>
  waitFor(() => expect(nombresListados()).toHaveLength(cuantos));

const panelDeFiltros = () => document.querySelector(".asistencia-filtros-panel");

/**
 * Abre «Filtros» y despliega la lista de Sucursal.
 *
 * El disparador NO se busca por su texto visible, y hay un motivo que cuesta descubrir: vive
 * dentro de un `<label>Sucursal`, y un `<button>` es un elemento etiquetable — así que su nombre
 * accesible es «Sucursal» y no «Todas las sucursales», que es lo que se ve escrito. Buscarlo por
 * el único botón del panel es estable y además vale igual cuando ya hay una sucursal elegida y el
 * texto ha cambiado.
 */
const desplegarSucursal = async () => {
  // Solo se pulsa «Filtros» si el panel está cerrado: elegir una sucursal NO lo cierra (conducta
  // correcta, así se pueden cambiar varios filtros seguidos), y volver a pulsar el botón lo
  // cerraría. Sin esta condición, la segunda llamada dentro de una misma prueba fallaba.
  if (!panelDeFiltros()) await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
  await userEvent.click(within(panelDeFiltros()).getByRole("button"));
};

beforeEach(() => {
  vi.clearAllMocks();
  getAsistencias.mockResolvedValue([]);
  subscribeAsistencias.mockReturnValue(() => {});
});

afterEach(cleanup);

describe("AsistenciaPanel · filtro de sucursal", () => {
  it("sin filtrar, lista a todo el mundo", async () => {
    render(<AsistenciaPanel usuarios={USUARIOS} />);
    await esperarLista(3);
    expect(nombresListados()).toEqual(["JUANA GARAY", "PERLA CRUZ", "VALERIA ALCARAZ"]);
  });

  it("REGRESIÓN: elegir una sucursal filtra la lista de verdad", async () => {
    // El fallo del 6-ago: esto no hacía NADA. El panel de Filtros se cerraba en el `mousedown`
    // —porque la lista del Select vive en un portal a <body>, fuera del ref del panel— y el
    // `click` nunca llegaba a la opción. La lista seguía con las tres personas.
    render(<AsistenciaPanel usuarios={USUARIOS} />);
    await esperarLista(3);

    await desplegarSucursal();
    await userEvent.click(screen.getByRole("option", { name: "McDental Tampico" }));

    expect(nombresListados()).toEqual(["PERLA CRUZ"]);
  });

  it("el contador de Filtros marca 1 cuando hay una sucursal elegida", async () => {
    render(<AsistenciaPanel usuarios={USUARIOS} />);
    await esperarLista(3);

    expect(
      screen.getByRole("button", { name: /Filtros/ }).querySelector(".asistencia-filtros-badge")
    ).toBeNull();

    await desplegarSucursal();
    await userEvent.click(screen.getByRole("option", { name: "McDental Palmas" }));

    expect(
      within(screen.getByRole("button", { name: /Filtros/ })).getByText("1")
    ).toBeTruthy();
  });

  it("volver a «Todas» devuelve a todo el mundo", async () => {
    render(<AsistenciaPanel usuarios={USUARIOS} />);
    await esperarLista(3);

    await desplegarSucursal();
    await userEvent.click(screen.getByRole("option", { name: "McDental Palmas" }));
    expect(nombresListados()).toEqual(["JUANA GARAY", "VALERIA ALCARAZ"]);

    // El disparador ahora muestra la sucursal elegida, no «Todas las sucursales».
    await desplegarSucursal();
    await userEvent.click(screen.getByRole("option", { name: "Todas las sucursales" }));

    expect(nombresListados()).toHaveLength(3);
  });

  it("el buscador y el filtro de sucursal se combinan", async () => {
    render(<AsistenciaPanel usuarios={USUARIOS} />);
    await esperarLista(3);

    await desplegarSucursal();
    await userEvent.click(screen.getByRole("option", { name: "McDental Palmas" }));

    await userEvent.type(screen.getByPlaceholderText(/Buscar empleado/), "valeria");
    expect(nombresListados()).toEqual(["VALERIA ALCARAZ"]);
  });

  it("un clic realmente fuera cierra el panel de Filtros", async () => {
    // La exclusión del portal no puede pasarse de lista.
    render(<AsistenciaPanel usuarios={USUARIOS} />);
    await esperarLista(3);

    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(panelDeFiltros()).not.toBeNull();

    await userEvent.click(document.body);
    expect(panelDeFiltros()).toBeNull();
  });
});
