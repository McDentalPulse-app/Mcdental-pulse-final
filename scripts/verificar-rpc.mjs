/**
 * ¿La base tiene las funciones que el API va a llamar, con los parámetros que le va a pasar?
 *
 * POR QUÉ EXISTE. El 2026-09-21 se desplegó un `api/checar.js` que llamaba a `registrar_checada`
 * con `p_id_cliente`. Ese parámetro lo añadía la migración 165, que llevaba cuatro días en el
 * repositorio y NO estaba aplicada en producción. PostgREST no encontró la firma, devolvió
 * PGRST202, y toda la clínica se quedó sin poder fichar — PWA y app nativa a la vez— hasta que
 * alguien lo desconectó a mano en la VPS.
 *
 * LO QUE NO SE PUEDE ARREGLAR CON UN REGISTRO DE MIGRACIONES, y por eso esto comprueba otra cosa.
 * No hay tabla `supabase_migrations.schema_migrations` en esta base, y crearla ahora exigiría
 * decidir cuáles de las 164 migraciones están aplicadas. Eso no se sabe: la 166 está y la 165 no
 * estaba, así que el orden numérico no sirve para deducirlo. Un registro construido a ojo diría
 * hoy que la 165 estaba aplicada, que es exactamente la mentira que causó el apagón.
 *
 * Así que no se pregunta "¿qué migraciones corrieron?" sino "¿existe LO QUE EL CÓDIGO VA A USAR?".
 * Esa pregunta tiene una respuesta cierta, se saca de la base en un segundo, y es la que habría
 * parado el despliegue de hoy.
 *
 * SE LEE EL CÓDIGO CON UN PARSER DE VERDAD, y esa decisión tiene su propia historia. La primera
 * versión buscaba las llamadas con una expresión regular y contaba llaves a mano. Una revisión
 * independiente la rompió por cinco sitios en diez minutos: un valor con `https://` dentro hacía
 * desaparecer los parámetros siguientes de esa misma llamada —el mismo fallo que esto existe para
 * evitar, reencarnado dentro del verificador—, un comentario de bloque con la forma «nota: x»
 * inventaba un parámetro que no existía, y un `.rpc()` escrito dentro de un comentario se leía
 * como código real. Los tres son la misma causa: un texto no sabe dónde empieza un string.
 *
 * `acorn` sí lo sabe. Ya
 * está instalado —lo usan eslint y vite— y borra esa clase entera de fallos en vez de taparlos
 * uno a uno.
 *
 * ALCANCE, dicho claro: comprueba las llamadas RPC de `api/`. No comprueba columnas, ni policies,
 * ni las llamadas del navegador. Cubre la forma exacta en la que ya nos hemos caído una vez; si
 * nos caemos por otra, se amplía entonces y no antes.
 *
 * Uso:
 *   node scripts/verificar-rpc.mjs            # en la VPS, contra pulse-db
 *   PSQL='psql -U postgres -d postgres' node scripts/verificar-rpc.mjs   # otra forma de conectar
 *
 * Sale con 1 si falta algo, que es lo que aborta el despliegue en `infra/scripts/build-api.sh`.
 */
import { parse } from "acorn";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Recorre el árbol entero. Diez líneas en vez de otra dependencia para caminarlo. */
function recorrer(nodo, visita) {
  if (!nodo || typeof nodo.type !== "string") return;
  visita(nodo);
  for (const clave of Object.keys(nodo)) {
    const valor = nodo[clave];
    if (Array.isArray(valor)) for (const hijo of valor) recorrer(hijo, visita);
    else if (valor && typeof valor === "object") recorrer(valor, visita);
  }
}

/**
 * Saca de un fichero JS las llamadas `.rpc("nombre", { p_algo: ... })`.
 *
 * `incompleta` marca lo que NO se ha podido leer del todo: un nombre que sale de una variable, o
 * un `...spread` que trae parámetros de otro sitio. Eso se avisa pero NO aborta el despliegue, y
 * la asimetría es deliberada: bloquear por algo que no se ha podido comprobar dejaría al equipo
 * sin desplegar un arreglo urgente por un idioma que hoy no usa nadie. Abortar se reserva para lo
 * que es seguro que está roto.
 */
export function llamadasRpc(fuente) {
  const ast = parse(fuente, { ecmaVersion: "latest", sourceType: "module" });
  const encontradas = [];

  recorrer(ast, (n) => {
    if (n.type !== "CallExpression") return;
    const receptor = n.callee;
    if (receptor.type !== "MemberExpression") return;
    // `cliente.rpc(...)` y `cliente["rpc"](...)` son la misma llamada. Aceptar solo la primera
    // dejaba la segunda invisible: no se usa hoy, pero un verificador con un punto ciego no
    // avisa de que lo tiene.
    const nombreMetodo = receptor.computed
      ? receptor.property.type === "Literal"
        ? receptor.property.value
        : null
      : receptor.property.name;
    if (nombreMetodo !== "rpc") return;

    const [nombreNodo, argumentosNodo] = n.arguments;

    if (nombreNodo?.type !== "Literal" || typeof nombreNodo.value !== "string") {
      encontradas.push({ nombre: null, parametros: [], incompleta: "el nombre no es literal" });
      return;
    }
    const nombre = nombreNodo.value;

    if (!argumentosNodo) {
      encontradas.push({ nombre, parametros: [], incompleta: null });
      return;
    }
    if (argumentosNodo.type !== "ObjectExpression") {
      encontradas.push({ nombre, parametros: [], incompleta: "los parametros no son un objeto" });
      return;
    }

    const parametros = [];
    let incompleta = null;
    for (const propiedad of argumentosNodo.properties) {
      if (propiedad.type === "SpreadElement") {
        incompleta = "hay un ...spread entre los parametros";
        continue;
      }
      const clave = propiedad.key;
      // `{ p_x: 1 }` y `{ "p_x": 1 }` son lo mismo para PostgREST, así que aquí también.
      //
      // `{ [algo]: 1 }` NO lo es, y esa distinción la marca `computed`, no el tipo de la clave:
      // sin mirarla, `{ [miVariable]: 1 }` se leía como un parámetro llamado literalmente
      // "miVariable" — un nombre que no existe en ninguna firma y que abortaría el despliegue
      // por un parámetro que nadie manda.
      if (propiedad.computed) {
        if (clave.type === "Literal") parametros.push(String(clave.value));
        else incompleta = "hay una clave calculada entre los parametros";
      } else if (clave.type === "Identifier") parametros.push(clave.name);
      else if (clave.type === "Literal") parametros.push(String(clave.value));
      else incompleta = "hay una clave que no se pudo leer entre los parametros";
    }

    encontradas.push({ nombre, parametros, incompleta });
  });

  return encontradas;
}

/**
 * Convierte la salida de psql en el mapa de firmas: función → lista de sobrecargas, cada una con
 * los nombres de sus parámetros DE ENTRADA.
 *
 * LOS PARÁMETROS DE SALIDA NO CUENTAN, y esto es un arreglo (2026-09-21, hallazgo de la segunda
 * revisión). `proargnames` mezcla entradas y salidas en una sola lista; quién es quién lo dice
 * `proargmodes` en la misma posición. Sin cruzarlas, un nombre que solo existe como SALIDA se
 * aceptaba como si se pudiera pasar de entrada.
 *
 * No es teórico: `checar_ubicacion` en producción tiene `{i,i,i,i,i,i,o,o}`, con `estado` y
 * `distancia` de salida. Pasar `estado` en la llamada daba luz verde aquí y un PGRST202 en
 * producción — es decir, el verificador aprobaba exactamente el fallo que existe para impedir.
 *
 * `proargmodes` es NULL cuando TODOS los argumentos son de entrada, que es el caso corriente.
 */
export function firmasDeSalida(texto) {
  const DE_ENTRADA = new Set(["i", "b", "v"]); // in, inout, variadic
  const firmas = new Map();

  for (const linea of texto.split("\n").filter(Boolean)) {
    const [nombre, nombresCrudos = "", modosCrudos = ""] = linea.split("|");
    const nombres = nombresCrudos ? nombresCrudos.split(",") : [];
    const modos = modosCrudos ? modosCrudos.split(",") : [];
    const entradas = modos.length === 0 ? nombres : nombres.filter((_, i) => DE_ENTRADA.has(modos[i]));

    if (!firmas.has(nombre)) firmas.set(nombre, []);
    firmas.get(nombre).push(entradas);
  }
  return firmas;
}

/** Las firmas vivas: para cada función, los nombres de sus argumentos. Una fila por sobrecarga. */
function firmasEnLaBase(psql, nombres) {
  const lista = nombres.map((n) => `'${n}'`).join(",");
  const sql =
    "select p.proname || '|' || coalesce(array_to_string(p.proargnames, ','), '') " +
    "|| '|' || coalesce(array_to_string(p.proargmodes, ','), '') " +
    "from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
    `where n.nspname = 'public' and p.proname in (${lista})`;

  const [cmd, ...args] = psql.split(" ");
  let salida;
  try {
    salida = execFileSync(cmd, [...args, "-Atc", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    // SE DISTINGUE "no pude preguntar" DE "tu codigo esta mal", y hace falta: esto corre durante
    // un despliegue, a veces urgente, y un volcado de Node no dice cuál de las dos cosas pasa.
    console.error("\nABORTADO: no se pudo consultar la base para comprobar las funciones.");
    console.error(`  comando: ${psql}`);
    console.error(`  error:   ${(e.stderr || e.message || "").toString().trim().split("\n")[0]}`);
    console.error("\n¿Esta arriba el contenedor `pulse-db`? Esto NO dice que el codigo este mal:");
    console.error("dice que no se ha podido comprobar, y por eso no se despliega.\n");
    process.exit(1);
  }

  return firmasDeSalida(salida);
}

/**
 * Compara lo que el código llama con lo que la base tiene.
 *
 * Una llamada vale si ALGUNA sobrecarga admite todos sus parámetros. No se exige que coincidan
 * exactamente: los que faltan tienen valor por defecto, y eso es legítimo —`api/checar.js` pasaba
 * ocho de diez argumentos durante meses y funcionaba—. Lo que nunca es legítimo es pasar un
 * parámetro que no existe en ninguna firma, porque eso es un 404 para todo el mundo.
 */
export function problemas(llamadas, firmas) {
  const fallos = [];
  for (const { fichero, nombre, parametros } of llamadas) {
    if (nombre === null) continue; // ya se avisó por otro lado; no se puede comprobar.
    const sobrecargas = firmas.get(nombre);
    if (!sobrecargas) {
      fallos.push(`${fichero}: la funcion '${nombre}' NO EXISTE en la base`);
      continue;
    }
    const vale = sobrecargas.some((args) => parametros.every((p) => args.includes(p)));
    if (!vale) {
      const sobran = parametros.filter((p) => !sobrecargas.some((a) => a.includes(p)));
      fallos.push(
        `${fichero}: '${nombre}' no admite ${sobran.map((s) => `'${s}'`).join(", ")}` +
          ` — firmas vivas: ${sobrecargas.map((a) => `(${a.join(", ")})`).join(" ")}`,
      );
    }
  }
  return fallos;
}

function principal() {
  const psql = process.env.PSQL ?? "docker exec pulse-db psql -U postgres -d postgres";
  const dirApi = join(dirname(fileURLToPath(import.meta.url)), "..", "api");

  const llamadas = [];
  // Recursivo: si algún día se anida código bajo `api/`, no se queda fuera en silencio.
  const ficheros = readdirSync(dirApi, { recursive: true })
    .filter((f) => f.endsWith(".js") && !f.includes(".test."));

  for (const f of ficheros) {
    const ruta = join(dirApi, f);
    let leidas;
    try {
      leidas = llamadasRpc(readFileSync(ruta, "utf8"));
    } catch (e) {
      console.error(`\nABORTADO: no se pudo leer api/${f} como JavaScript: ${e.message}\n`);
      process.exit(1);
    }
    for (const l of leidas) llamadas.push({ ...l, fichero: `api/${f}` });
  }

  if (llamadas.length === 0) {
    console.error("verificar-rpc: no se encontro ninguna llamada .rpc() en api/ — ¿se movieron?");
    process.exit(1);
  }

  // Los avisos van antes que los fallos: si el despliegue se aborta, esto sigue siendo visible.
  for (const l of llamadas.filter((l) => l.incompleta)) {
    console.error(`  ! ${l.fichero}: '${l.nombre ?? "?"}' no se pudo comprobar del todo (${l.incompleta})`);
  }

  const nombres = [...new Set(llamadas.map((l) => l.nombre).filter(Boolean))];
  const fallos = problemas(llamadas, firmasEnLaBase(psql, nombres));

  if (fallos.length > 0) {
    console.error("\nABORTADO: el codigo llama a algo que la base no tiene.\n");
    for (const f of fallos) console.error(`  ✗ ${f}`);
    console.error("\nCasi siempre significa que falta aplicar una migracion en produccion.\n");
    process.exit(1);
  }

  console.log(`verificar-rpc: ${llamadas.length} llamadas RPC comprobadas contra la base, todas existen.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) principal();
