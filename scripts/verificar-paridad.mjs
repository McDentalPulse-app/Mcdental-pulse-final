/**
 * ¿Sigue la base cobrando lo mismo que la web? Preflight de `infra/scripts/build-frontend.sh`.
 *
 * POR QUÉ EXISTE. Las reglas de asistencia y nómina viven DOS veces: en JavaScript
 * (`src/utils/asistencia.js` + `src/utils/nomina.js`, lo que RH ve en la Nómina) y en SQL
 * (`resumen_asistencia_semana` y `recibo_semana`, lo que la app nativa enseña en «Tu semana»).
 * Entre el 2026-09-23 y el 26 la web cambió cómo se cobra y la base no; nada falló, y durante
 * días la app le enseñó a la gente hasta $18,600 por semana de descuentos que la nómina no
 * cobraba. Nadie lo vio hasta que alguien volvió a comparar a mano.
 *
 * Así que se compara SIEMPRE antes de desplegar la web: si el código nuevo cambia una regla que
 * la base no tiene, el despliegue no empieza. Lo que hay que hacer entonces es portar el cambio
 * a una migración (ver la 177) y aplicarla, no saltarse esto.
 *
 * QUÉ HACE: vuelca de la base las últimas 8 semanas (scripts/paridad-asistencia.sql, que termina
 * en ROLLBACK: solo lee) y corre scripts/paridad-asistencia.test.mjs contra ese volcado.
 * Criterio: cero diferencias.
 *
 * Sale con 1 si hay diferencias, y también si no se pudo consultar la base: sin comparar no se
 * sabe, y el mensaje distingue los dos casos para que nadie busque en el código un fallo de
 * infraestructura (¿está arriba `pulse-db`?).
 *
 * Uso:
 *   node scripts/verificar-paridad.mjs                              # en la VPS, contra pulse-db
 *   PSQL='ssh ... docker exec -i pulse-db psql -U postgres -d postgres' node scripts/verificar-paridad.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMANAS = 8;
const TZ = "America/Monterrey";

const [cmd, ...base] = (process.env.PSQL ?? "docker exec -i pulse-db psql -U postgres -d postgres").split(" ");

const psql = (args, entrada) =>
  execFileSync(cmd, [...base, "-t", "-A", "-v", "ON_ERROR_STOP=1", ...args], {
    input: entrada,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });

const infraestructura = (e) => {
  console.error("ABORTADO: no se pudo consultar la base para comparar la nómina con la app.");
  console.error("Esto es infraestructura (¿está arriba pulse-db?), no el código de la web.");
  console.error(String(e?.stderr || e?.message || e).trim());
  process.exit(1);
};

/** "YYYY-MM-DD" de hoy en Monterrey, y desplazamientos en días sin depender del huso local. */
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const masDias = (f, n) => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = new Date(`${hoy}T12:00:00Z`).getUTCDay() || 7; // 1 = lunes … 7 = domingo
const domingo = masDias(hoy, 7 - dow); // el de esta semana, que sigue en curso
const desde = masDias(domingo, -(SEMANAS * 7) + 1); // un lunes

// El volcado se hace como un admin: es a quien el guard de las funciones deja ver a cualquiera.
let sub;
try {
  sub = psql(
    [],
    `select auth_user_id from public.usuarios
      where role::text = 'admin' and auth_user_id is not null and coalesce(inactivo, false) = false
      order by name limit 1;`,
  ).trim();
} catch (e) {
  infraestructura(e);
}
if (!sub) infraestructura("no hay ninguna cuenta admin activa con la que volcar los datos");

let crudo;
try {
  crudo = psql(
    ["-v", `desde=${desde}`, "-v", `hasta=${domingo}`, "-v", `sub=${sub}`],
    readFileSync(join(raiz, "scripts/paridad-asistencia.sql"), "utf8"),
  );
} catch (e) {
  infraestructura(e);
}
// La línea del volcado; la de set_config también empieza por "{" y no es esta.
const json = crudo.split("\n").find((l) => l.startsWith('{"desde"'));
if (!json) infraestructura("el volcado no devolvió datos");

const dir = mkdtempSync(join(tmpdir(), "paridad-"));
const archivo = join(dir, "datos.json");
writeFileSync(archivo, json);

console.log(`paridad nómina ↔ app: semanas del ${desde} al ${domingo}`);
const r = spawnSync("npx", ["vitest", "run", "scripts/paridad-asistencia.test.mjs"], {
  cwd: raiz,
  env: { ...process.env, PARIDAD_JSON: archivo },
  stdio: "inherit",
});
rmSync(dir, { recursive: true, force: true });

// Que vitest no arranque no es una diferencia de reglas: se dice como lo que es.
if (r.error || r.status === null) infraestructura(r.error || "vitest no terminó");
if (r.status !== 0) {
  console.error("ABORTADO: la base ya no cobra lo mismo que la web (arriba, las diferencias).");
  console.error("Porta el cambio de reglas a una migración nueva de resumen_asistencia_semana /");
  console.error("recibo_semana (ver la 177), aplícala, y vuelve a desplegar.");
  process.exit(1);
}
console.log("paridad nómina ↔ app: 0 diferencias.");
