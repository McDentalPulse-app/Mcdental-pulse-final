import { describe, expect, it } from "vitest";
import { firmasDeSalida, llamadasRpc, problemas } from "./verificar-rpc.mjs";

/**
 * El verificador que tiene que parar el próximo apagón.
 *
 * LA MITAD DE ESTOS CASOS SON DEFECTOS REPRODUCIDOS, no hipótesis. La primera versión leía el
 * código con una expresión regular contando llaves a mano, y una revisión independiente la rompió
 * por cinco sitios. Cada uno de esos cinco está aquí abajo, con su nombre, para que si alguien
 * vuelve a cambiar el parser por algo "más simple" se entere en el momento y no en producción.
 *
 * Y la lección que los trajo: un texto no sabe dónde empieza un string. Por eso ahora lo lee
 * `acorn`, que ya estaba instalado.
 */
describe("leer las llamadas .rpc() del código", () => {
  it("ve los parámetros aunque haya comentarios largos en medio", () => {
    // El comentario lleva `NOTA:` a propósito: una versión anterior de esta prueba usaba texto sin
    // dos puntos, así que pasaba igual aunque se borrara entero el mecanismo que dice proteger.
    // Lo detectó un mutation testing en la revisión, no yo.
    const fuente = `
      const { data } = await supabase.rpc("registrar_checada", {
        p_empleado_id: quien.id,
        p_tipo: tipo,
        // NOTA: la pieza que evita la checada duplicada, de la migración 165.
        p_id_cliente: idCliente ?? null,
      });
    `;
    expect(llamadasRpc(fuente)).toEqual([
      {
        nombre: "registrar_checada",
        parametros: ["p_empleado_id", "p_tipo", "p_id_cliente"],
        incompleta: null,
      },
    ]);
  });

  it("DEFECTO REPRODUCIDO: un valor con `https://` no se come los parámetros siguientes", () => {
    // El peor de los cinco. Con el lector anterior, `p_b` desaparecía sin aviso porque el `//` de
    // la URL se tomaba por el principio de un comentario — y un parámetro que no se comprueba es
    // un despliegue aprobado a ciegas. Es el apagón del 21-09 dentro del propio verificador.
    const r = llamadasRpc(`supabase.rpc("f", { p_url: "https://x.com/cb", p_b: 2 });`);
    expect(r[0].parametros).toEqual(["p_url", "p_b"]);
  });

  it("DEFECTO REPRODUCIDO: un comentario de bloque no inventa un parámetro", () => {
    // Antes, `/* nota: x */` metía `nota` en la lista. Si `nota` no existe en la base —no existe—
    // el script abortaba el despliegue por una explicación escrita en un comentario.
    const r = llamadasRpc(`supabase.rpc("f", { p_a: 1, /* nota: x */ p_b: 2 });`);
    expect(r[0].parametros).toEqual(["p_a", "p_b"]);
  });

  it("DEFECTO REPRODUCIDO: un .rpc() dentro de un comentario no es una llamada", () => {
    expect(llamadasRpc(`// supabase.rpc("fantasma", { p_x: 1 });`)).toEqual([]);
  });

  it("DEFECTO REPRODUCIDO: un .rpc() dentro de un string tampoco lo es", () => {
    expect(llamadasRpc(`console.log('supabase.rpc("fantasma", { p_x: 1 })');`)).toEqual([]);
  });

  it("DEFECTO REPRODUCIDO: un ...spread se marca, no se ignora en silencio", () => {
    // Ignorarlo callando era un falso negativo: los parámetros que trae el spread no se comprueban
    // y el script decía que todo estaba bien. Ahora se avisa. NO aborta: bloquear por algo que no
    // se ha podido leer dejaría al equipo sin desplegar un arreglo urgente.
    const r = llamadasRpc(`supabase.rpc("f", { ...comunes, p_c: 3 });`);
    expect(r[0].parametros).toEqual(["p_c"]);
    expect(r[0].incompleta).toContain("spread");
  });

  it("una clave entre comillas es un parámetro como cualquier otro", () => {
    expect(llamadasRpc(`supabase.rpc("f", { "p_x": 1 });`)[0].parametros).toEqual(["p_x"]);
  });

  it("DEFECTO REPRODUCIDO: una clave calculada no se lee como el nombre de la variable", () => {
    // Antes, `{ [miVariable]: 1 }` daba un parámetro llamado literalmente "miVariable" — un
    // nombre que no existe en ninguna firma, así que abortaba el despliegue por un parámetro
    // que nadie manda. Es un falso positivo, y esos dejan al equipo sin poder desplegar.
    const r = llamadasRpc(`supabase.rpc("f", { [miVariable]: 1 });`);
    expect(r[0].parametros).toEqual([]);
    expect(r[0].incompleta).toContain("calculada");
  });

  it("una clave calculada que es una cadena SÍ es un nombre, y se lee", () => {
    expect(llamadasRpc(`supabase.rpc("f", { ["p_x"]: 1 });`)[0].parametros).toEqual(["p_x"]);
  });

  it("DEFECTO REPRODUCIDO: una llamada con corchetes no es invisible", () => {
    expect(llamadasRpc(`cliente["rpc"]("f", { p_x: 1 });`)[0].nombre).toBe("f");
  });

  it("un nombre que sale de una variable se marca como no comprobable", () => {
    const r = llamadasRpc(`supabase.rpc(cual, { p_x: 1 });`);
    expect(r[0].nombre).toBeNull();
    expect(r[0].incompleta).toBeTruthy();
  });

  it("acepta una llamada sin argumentos", () => {
    expect(llamadasRpc(`await supabase.rpc("consumir_cuota_ia");`)).toEqual([
      { nombre: "consumir_cuota_ia", parametros: [], incompleta: null },
    ]);
  });

  it("no confunde un objeto anidado con parámetros de la función", () => {
    const r = llamadasRpc(`supabase.rpc("f", { p_uno: 1, p_dos: { anidado: 2, otro: 3 } });`);
    expect(r[0].parametros).toEqual(["p_uno", "p_dos"]);
  });

  it("encuentra varias llamadas en el mismo fichero, aunque estén encadenadas", () => {
    const fuente = `
      await supabase.rpc("a", { p_x: 1 });
      const { data } = await admin().rpc("b", { p_y: 2 });
    `;
    expect(llamadasRpc(fuente).map((l) => l.nombre)).toEqual(["a", "b"]);
  });
});

/**
 * Leer las firmas de la base, que es donde estaba el fallo que encontró la segunda revisión.
 *
 * `proargnames` mezcla entradas y salidas; `proargmodes` dice cuál es cuál. Sin cruzarlas, un
 * nombre de SALIDA se aceptaba como entrada válida — el verificador daba luz verde a la llamada
 * que PostgREST iba a rechazar. Las dos firmas de abajo son las REALES de producción.
 */
describe("leer las firmas de la base", () => {
  it("EL FALLO DE LA 2ª REVISIÓN: un parámetro de SALIDA no cuenta como entrada", () => {
    // checar_ubicacion en producción: {i,i,i,i,i,i,o,o} — `estado` y `distancia` son de salida.
    const firmas = firmasDeSalida(
      "checar_ubicacion|p_empleado_id,p_lat,p_lng,p_precision,p_tipo,p_entrada_libre,estado,distancia|i,i,i,i,i,i,o,o",
    );
    expect(firmas.get("checar_ubicacion")).toEqual([
      ["p_empleado_id", "p_lat", "p_lng", "p_precision", "p_tipo", "p_entrada_libre"],
    ]);

    // Y la consecuencia, que es lo que de verdad se prueba: pasar `estado` tiene que fallar.
    const fallos = problemas(
      [{ fichero: "api/checar.js", nombre: "checar_ubicacion", parametros: ["p_empleado_id", "estado"] }],
      firmas,
    );
    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toContain("estado");
  });

  it("sin proargmodes, todos los argumentos son de entrada", () => {
    // Es el caso corriente: Postgres deja `proargmodes` en NULL cuando no hay ninguna salida.
    const firmas = firmasDeSalida("registrar_checada|p_empleado_id,p_tipo|");
    expect(firmas.get("registrar_checada")).toEqual([["p_empleado_id", "p_tipo"]]);
  });

  it("los modos inout y variadic SÍ son de entrada", () => {
    expect(firmasDeSalida("f|p_a,p_b,p_c,p_d|i,b,v,o").get("f")).toEqual([["p_a", "p_b", "p_c"]]);
  });

  it("una función sin argumentos no rompe la lectura", () => {
    expect(firmasDeSalida("estado_del_sistema||").get("estado_del_sistema")).toEqual([[]]);
  });

  it("dos sobrecargas de la misma función son dos entradas", () => {
    expect(firmasDeSalida("f|p_a|i\nf|p_a,p_b|i,i").get("f")).toEqual([["p_a"], ["p_a", "p_b"]]);
  });
});

describe("comparar con lo que la base tiene", () => {
  const firmas = new Map([
    ["registrar_checada", [["p_empleado_id", "p_tipo", "p_entrada_libre"]]],
  ]);

  it("EL APAGÓN DEL 21-09: un parámetro que la base no tiene aborta el despliegue", () => {
    const fallos = problemas(
      [{ fichero: "api/checar.js", nombre: "registrar_checada", parametros: ["p_empleado_id", "p_id_cliente"] }],
      firmas,
    );
    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toContain("p_id_cliente");
  });

  it("pasar menos parámetros de los que admite es legítimo: los demás tienen valor por defecto", () => {
    const fallos = problemas(
      [{ fichero: "api/checar.js", nombre: "registrar_checada", parametros: ["p_empleado_id"] }],
      firmas,
    );
    expect(fallos).toEqual([]);
  });

  it("una función que no existe se reporta como tal, no como parámetro que sobra", () => {
    const fallos = problemas([{ fichero: "api/x.js", nombre: "funcion_fantasma", parametros: [] }], firmas);
    expect(fallos[0]).toContain("NO EXISTE");
  });

  it("vale si ALGUNA sobrecarga admite todos los parámetros", () => {
    const conSobrecargas = new Map([["f", [["p_a"], ["p_a", "p_b"]]]]);
    expect(problemas([{ fichero: "api/x.js", nombre: "f", parametros: ["p_a", "p_b"] }], conSobrecargas)).toEqual([]);
  });

  it("una llamada sin nombre literal no puede fallar la comprobación: ya se avisó aparte", () => {
    expect(problemas([{ fichero: "api/x.js", nombre: null, parametros: [] }], firmas)).toEqual([]);
  });
});
