// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * El guardado que falla A MEDIAS, que es donde este editor se ha roto dos veces seguidas.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. `saveEncuestaPreguntas` borra primero y hace upsert después, así
 * que un fallo entre las dos mitades deja la base y la memoria diciendo cosas distintas. Ese
 * camino no lo cubría ninguna prueba, y por ahí entraron DOS defectos seguidos:
 *
 *   1. Resurrección. El borrado ocurría, el upsert fallaba, y la lista en memoria conservaba la
 *      pregunta borrada. Al reabrir el editor, el borrador salía de esa lista vieja y el
 *      siguiente guardado la REINSERTABA con su uuid original.
 *   2. Borrado perdido. El arreglo de lo anterior releía la base pero vaciaba `eliminadas` SIN
 *      condiciones, incluso cuando el borrado nunca había ocurrido. El reintento dejaba de
 *      pedirlo, el upsert funcionaba, y la app cantaba «guardadas correctamente» con la pregunta
 *      todavía viva en la base y ya invisible en la pantalla.
 *
 * Los dos pasaron los 659 tests del repo sin despeinarse, porque ninguno tocaba este camino.
 *
 * LO QUE VIGILAN ESTAS PRUEBAS es una sola regla, la que ambos defectos violaban: la app nunca
 * debe decir que borró algo que no borró, ni dejar de pedir un borrado que sigue pendiente.
 *
 * POR QUÉ IMPORTA MÁS DE LO QUE PARECE: `encuestaPreguntas` se carga UNA sola vez, al entrar a la
 * app — no tiene polling ni realtime, a diferencia de usuarios o encuestas. Una lista en memoria
 * equivocada no se arregla sola: se queda así hasta que alguien recarga la página.
 *
 * LO QUE SE SIMULA Y LO QUE NO. Solo las puertas de datos (los dos servicios) y los dos contextos.
 * La lógica que se está probando —qué se manda a borrar y qué se conserva para el reintento— corre
 * de verdad, dentro del componente real.
 */

const saveEncuestaPreguntas = vi.fn();
const getEncuestaPreguntas = vi.fn();

vi.mock("../../services/supabase/encuestaPreguntasService", () => ({
  saveEncuestaPreguntas: (...a) => saveEncuestaPreguntas(...a),
}));

vi.mock("../../services/supabase/usuariosService", () => ({
  getEncuestaPreguntas: (...a) => getEncuestaPreguntas(...a),
}));

const setEncuestaPreguntas = vi.fn();
let preguntasEnMemoria = [];

vi.mock("../../contexts/GlobalContext", () => ({
  useGlobal: () => ({
    encuestaPreguntas: preguntasEnMemoria,
    setEncuestaPreguntas,
    encuestaBloques: [],
  }),
}));

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const confirm = vi.fn();

vi.mock("../../contexts/NotificationContext", () => ({
  useNotification: () => ({ toast, confirm }),
}));

// El banco de bloques es una pantalla entera con sus propios servicios y no pinta nada en lo que
// se está probando. Se sustituye para no arrastrar sus dependencias hasta aquí.
vi.mock("./GestionBloques", () => ({ default: () => null }));

// jsdom no implementa scrollIntoView y el Select lo usa. Carencia del entorno, no del componente.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const GestionEncuestas = (await import("./GestionEncuestas")).default;

const P1 = {
  id: "uuid-1", texto: "Pregunta uno", tipo: "escala",
  area: "Emocional", orden: 1, activa: true, bloqueId: null, peso: 1,
};
const P2 = {
  id: "uuid-2", texto: "Pregunta dos", tipo: "escala",
  area: "Estrés", orden: 2, activa: true, bloqueId: null, peso: 1,
};

/** La fila del editor que contiene ese texto. */
const filaDe = (texto) =>
  [...document.querySelectorAll(".encuesta-edit-row")].find((f) =>
    f.textContent.includes(texto),
  );

const boton = (nombre) => screen.getByRole("button", { name: nombre });

/**
 * Abre el editor y borra «Pregunta dos», dejando el borrador listo para guardar.
 *
 * Se borra la SEGUNDA y no la primera a propósito: así queda una escala activa en el núcleo y no
 * salta la guarda que impide dejar la encuesta sin nada que puntúe — esa guarda tiene su propio
 * motivo y no es lo que se está probando aquí.
 */
const abrirYBorrarLaSegunda = async (user) => {
  await user.click(boton(/Editar preguntas/));
  await user.click(within(filaDe("Pregunta dos")).getByRole("button", { name: /Eliminar/ }));
  await waitFor(() => expect(filaDe("Pregunta dos")).toBeUndefined());
};

/** Los ids que el guardado número `n` pidió borrar. */
const idsBorradosEnLlamada = (n) => saveEncuestaPreguntas.mock.calls[n][1];

/** Los ids que el guardado número `n` mandó a upsert. */
const idsGuardadosEnLlamada = (n) => saveEncuestaPreguntas.mock.calls[n][0].map((p) => p.id);

beforeEach(() => {
  preguntasEnMemoria = [P1, P2];
  saveEncuestaPreguntas.mockReset();
  getEncuestaPreguntas.mockReset();
  setEncuestaPreguntas.mockReset();
  Object.values(toast).forEach((t) => t.mockReset());
  // Vale para las dos confirmaciones que salen por el camino: la del borrado y la del guardado.
  confirm.mockReset().mockResolvedValue(true);
});

afterEach(cleanup);

describe("el guardado falla después de haber borrado", () => {
  it("si el borrado NO ocurrió, el reintento lo vuelve a pedir", async () => {
    // Este es el defecto nº 2. El guardado falla y la relectura demuestra que «Pregunta dos»
    // SIGUE en la base: el borrado no llegó a aplicarse, así que no se puede dar por hecho.
    const user = userEvent.setup();
    saveEncuestaPreguntas.mockRejectedValueOnce(new Error("se cayó la red"));
    getEncuestaPreguntas.mockResolvedValue([P1, P2]);

    render(<GestionEncuestas encuestas={[]} />);
    await abrirYBorrarLaSegunda(user);

    await user.click(boton(/Guardar cambios/));
    await waitFor(() => expect(getEncuestaPreguntas).toHaveBeenCalled());
    expect(idsBorradosEnLlamada(0)).toEqual(["uuid-2"]);
    expect(toast.success).not.toHaveBeenCalled();

    // Y ahora lo que de verdad importa: el segundo intento NO puede olvidarse del borrado.
    // Esta es la única aserción que distingue de verdad el código sano del enfermo. Hubo aquí
    // un test aparte que comprobaba que no saltara `toast.success`, y se retiró porque pasaba
    // igual con el defecto dentro: el éxito prematuro aparece en el SEGUNDO guardado, y además
    // el mock no depende de los argumentos, así que el toast se dispara igual de las dos
    // formas. Un test cuyo nombre promete una cobertura que no tiene es peor que no tenerlo —
    // es exactamente lo que dejó pasar los dos defectos que este archivo vigila.
    saveEncuestaPreguntas.mockResolvedValueOnce([P1]);
    await user.click(boton(/Guardar cambios/));
    await waitFor(() => expect(saveEncuestaPreguntas).toHaveBeenCalledTimes(2));

    expect(idsBorradosEnLlamada(1)).toEqual(["uuid-2"]);
  });

  it("si el borrado SÍ ocurrió, no se vuelve a pedir ni la pregunta resucita", async () => {
    // Este es el defecto nº 1. El borrado se aplicó y solo falló el upsert: la relectura ya no
    // encuentra «Pregunta dos», así que no hay que reintentar su borrado — y sobre todo no hay
    // que reenviarla en el upsert, que es lo que la reinsertaba con su uuid original.
    const user = userEvent.setup();
    saveEncuestaPreguntas.mockRejectedValueOnce(new Error("se cayó la red"));
    getEncuestaPreguntas.mockResolvedValue([P1]);

    render(<GestionEncuestas encuestas={[]} />);
    await abrirYBorrarLaSegunda(user);

    await user.click(boton(/Guardar cambios/));
    await waitFor(() => expect(setEncuestaPreguntas).toHaveBeenCalled());

    // La lista en memoria queda como la base, sin la borrada.
    const frescas = setEncuestaPreguntas.mock.calls.at(-1)[0];
    expect(frescas.map((p) => p.id)).toEqual(["uuid-1"]);

    saveEncuestaPreguntas.mockResolvedValueOnce([P1]);
    await user.click(boton(/Guardar cambios/));
    await waitFor(() => expect(saveEncuestaPreguntas).toHaveBeenCalledTimes(2));

    expect(idsBorradosEnLlamada(1)).toEqual([]);
    expect(idsGuardadosEnLlamada(1)).not.toContain("uuid-2");
  });

  it("si ni siquiera se puede releer, el borrado pendiente no se pierde", async () => {
    // El catch de dentro del catch. Sin base no hay forma de saber si el borrado ocurrió, y la
    // única respuesta honesta es conservarlo: que el reintento lo pida y que decida la base.
    const user = userEvent.setup();
    saveEncuestaPreguntas.mockRejectedValueOnce(new Error("se cayó la red"));
    getEncuestaPreguntas.mockRejectedValue(new Error("tampoco se puede leer"));

    render(<GestionEncuestas encuestas={[]} />);
    await abrirYBorrarLaSegunda(user);

    await user.click(boton(/Guardar cambios/));
    await waitFor(() => expect(getEncuestaPreguntas).toHaveBeenCalled());

    saveEncuestaPreguntas.mockResolvedValueOnce([P1]);
    await user.click(boton(/Guardar cambios/));
    await waitFor(() => expect(saveEncuestaPreguntas).toHaveBeenCalledTimes(2));

    expect(idsBorradosEnLlamada(1)).toEqual(["uuid-2"]);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
