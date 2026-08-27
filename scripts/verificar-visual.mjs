#!/usr/bin/env node
/**
 * Comprobaciones VISUALES sobre lo ya compilado.
 *
 * Las 512 pruebas de este repo son de lógica pura (`src/utils`, `src/config`) y pasaban en
 * verde con TODOS los fallos de estas dos semanas dentro: un modal que salía dentro de la
 * tarjeta en vez de sobre la pantalla, una lista topada que enseñaba 6 clínicas de 26, un
 * `:has()` que los teléfonos de antes de 2022 descartaban entero, un desplegable recortado, y
 * respuestas repetidas cuatro veces. Ninguno era un fallo de lógica; todos eran de pantalla.
 *
 * Cada vez hubo que montar a mano un banco con Chromium para medirlo. Esto es ese banco, pero
 * permanente y sobre el PAQUETE DESPLEGABLE, no sobre el código fuente: lo que importa es lo
 * que llega al navegador, y entre medias hay un compilador que reordena y fusiona reglas.
 *
 * Se ejecuta con `npm run verificar`, y `/opt/pulse/build-frontend.sh` lo llama antes de
 * construir la imagen. Si falla, no se despliega. Escape documentado: `VERIFICAR=0`.
 */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

// La carpeta a medir. Por defecto `dist/assets` (uso local, tras `npm run build`), pero el
// despliegue le pasa los assets EXTRAÍDOS DE LA IMAGEN ya construida: en el servidor la app se
// compila dentro de Docker y el anfitrión ni siquiera tiene todas las dependencias — un
// `npm run build` allí falla por `recharts`. Lo que hay que medir es lo que se va a servir.
const DIST = process.argv[2] || "dist/assets";
const fallos = [];
const pasos = [];
const avisos = [];

const comprobar = (nombre, ok, detalle = "") => {
  (ok ? pasos : fallos).push(`${nombre}${detalle ? ` — ${detalle}` : ""}`);
};

// ── 1. Lo que se puede leer del paquete sin abrir un navegador ────────────────
const archivos = readdirSync(DIST);
const css = archivos.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(DIST, f), "utf8")).join("\n");
const js = archivos.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(DIST, f), "utf8")).join("\n");

// `:has()` se descarta ENTERO en iOS < 15.4 y Chrome Android < 105. No degrada: la regla
// simplemente no existe. Costó dos rondas descubrirlo con el chat en un teléfono viejo.
const conHas = (css.match(/:has\(/g) || []).length;
comprobar("Sin :has() en el CSS", conHas === 0, conHas ? `${conHas} usos` : "");

// Un <select> nativo abre una lista que dibuja el sistema operativo y que ningún CSS alcanza.
const selectsNativos = (js.match(/jsxs?\("select"/g) || []).length;
comprobar("Sin <select> nativos", selectsNativos === 0, selectsNativos ? `${selectsNativos}` : "");

// Los cuatro tokens de los controles tienen que existir: si alguien los borra, cada campo
// vuelve a inventarse su radio y su borde, que es de donde se venía.
for (const token of ["--mc-control-radio", "--mc-control-borde", "--mc-control-fondo", "--mc-control-letra"]) {
  comprobar(`Token ${token}`, css.includes(token));
}

// Los popovers por ENCIMA DE TODOS los overlays. No basta con superar la barra del teléfono
// (200): con 250 quedaban detrás de los modales y no se podía cambiar de sucursal a nadie,
// porque ese formulario vive dentro de uno. Se compara contra el overlay más alto que exista
// en el propio CSS, para que la comprobación siga valiendo si mañana aparece uno más alto.
const zetas = [...css.matchAll(/z-index:(\d+)/g)].map((m) => Number(m[1]));
const overlayMasAlto = Math.max(
  ...[...css.matchAll(/-overlay\{[^}]*z-index:(\d+)/g)].map((m) => Number(m[1])), 1000
);
for (const clase of ["mc-select-menu", "mc-daterange-pop"]) {
  const m = css.match(new RegExp(`${clase}\\{[^}]*z-index:(\\d+)`));
  const z = m ? Number(m[1]) : null;
  comprobar(
    `.${clase} por encima de los modales`,
    z !== null && z > overlayMasAlto,
    z === null ? "no encontrado" : `es ${z}, el overlay más alto es ${overlayMasAlto}`
  );
}
void zetas;

// Ni `top` ni `bottom` heredados: los fija el componente al colocar el popover. Si la regla
// base (compartida con <WeekSelect>) vuelve a filtrar su `top: calc(100% + 6px)`, en un
// elemento `fixed` eso son 100vh y el menú se va fuera de la pantalla al abrir hacia arriba.
// Fue justo lo que impidió cambiar de sucursal a un empleado: el campo está abajo del
// formulario, así que era el que volteaba.
for (const clase of ["mc-select-menu", "mc-daterange-pop"]) {
  const m = css.match(new RegExp(`${clase}\\{([^}]*)`));
  const cuerpo = m ? m[1] : "";
  // El compilador puede fusionarlo en la forma corta: `inset: auto auto auto 0` es
  // top/right/bottom/left, así que vale igual mientras el primer y el tercer valor sean `auto`.
  const sueltos = /top:\s*auto/.test(cuerpo) && /bottom:\s*auto/.test(cuerpo);
  const enInset = /inset:\s*auto\s+\S+\s+auto\b/.test(cuerpo);
  const bien = sueltos || enInset;
  comprobar(
    `.${clase} no hereda top/bottom`,
    bien,
    bien ? "" : (m ? "no se ve top:auto ni un inset equivalente" : "no encontrado")
  );
}

// Los dos botones FLOTANTES del teléfono (Mensajes y Reuniones) no pueden acabar apagados.
//
// El 17 de agosto de 2026 nadie veía Reuniones en el móvil, y el botón se pintaba perfectamente:
// el `display:none` que lo esconde en escritorio estaba escrito AL FINAL del CSS, por debajo del
// `@media (max-width:768px)` que lo encendía. Una media query no añade especificidad, así que
// la regla suelta de más abajo ganaba también dentro del teléfono. En el móvil Reuniones no
// aparece en la barra de abajo ni en la hoja "Más" — solo existe este botón —, así que apagarlo
// dejaba el módulo entero inalcanzable, y ninguna prueba de lógica podía notarlo.
//
// Se mide sobre el CSS YA COMPILADO y por POSICIÓN, que es lo único que decide aquí: si el
// último `display:none` de una de esas clases viene DESPUÉS del que la enciende, está apagada.
for (const clase of ["mensajes-flotante", "reuniones-flotante"]) {
  // Se buscan reglas por su LISTA de selectores, no por `.clase{`: el compilador funde las dos
  // clases en una sola regla (`.mensajes-flotante,.reuniones-flotante{display:none}`), y un
  // patrón que exigiera la llave pegada no encontraría el apagado — daría verde justo en el
  // caso que esto vigila. El `(?![\w-])` evita picar en `.reuniones-flotante-punto`.
  const conLaClase = new RegExp(`\\.${clase}(?![\\w-])`);
  const reglas = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter((m) => conLaClase.test(m[1]));
  const enciende = reglas.filter((m) => /display:\s*(inline-)?flex/.test(m[2])).at(-1);
  const apaga = reglas.filter((m) => /display:\s*none/.test(m[2])).at(-1);
  const bien = Boolean(enciende) && (!apaga || apaga.index < enciende.index);
  comprobar(
    `.${clase} sigue encendido en el teléfono`,
    bien,
    !enciende ? "no hay ninguna regla que lo encienda" : (bien ? "" : "un display:none posterior lo apaga")
  );
}

// ── 2. Lo que hay que medir en un navegador de verdad ─────────────────────────
const chromium = ["chromium", "chromium-browser", "google-chrome"].find((c) => {
  try { execFileSync("which", [c], { stdio: "pipe" }); return true; } catch { return false; }
});

if (!chromium) {
  // NO se cuenta como aprobado ni como fallo: se avisa a gritos y se sigue.
  //
  // Contarlo como fallo bloquearía todos los despliegues del servidor, que no tiene navegador
  // instalado — y un guardián que impide desplegar siempre acaba desactivado, con lo que se
  // pierden también las comprobaciones que sí funcionan. Las estáticas de arriba (`:has()`,
  // `<select>` nativos, tokens, capas) son las que atraparon las regresiones reales de estas
  // dos semanas, y esas sí corren en todas partes.
  avisos.push("Chromium no está instalado: las comprobaciones de MEDIDA no se ejecutaron");
} else {
  const dir = mkdtempSync(join(tmpdir(), "verificar-"));
  writeFileSync(join(dir, "app.css"), css);

  // Un campo pegado al borde derecho y dentro de una tarjeta que recorta: las dos condiciones
  // que rompieron el desplegable y el calendario.
  const html = `<script>document.documentElement.setAttribute("data-theme","dark")</script>
<link rel="stylesheet" href="app.css">
<div class="mc-card" style="overflow:hidden;padding:14px;margin-left:auto;width:260px">
  <input class="mc-form-input" id="campo" value="x">
</div>
<div class="mc-select-menu" id="pop" style="position:fixed;left:120px;top:80px;min-width:240px">
  <button class="mc-select-option">Una opción con nombre largo de sucursal</button>
</div>
<pre id="out"></pre>
<script>
setTimeout(function(){
  var L=[], pop=document.getElementById("pop"), r=pop.getBoundingClientRect();
  var c=document.getElementById("campo"), cs=getComputedStyle(c);
  L.push("POPOVER_DENTRO=" + (r.left>=0 && r.right<=innerWidth+0.5));
  L.push("POPOVER_PADRE=" + pop.parentElement.tagName);
  L.push("CONTROL=" + [cs.borderRadius,cs.borderTopWidth,cs.fontSize].join("|"));
  L.push("SCROLL_H=" + (document.documentElement.scrollWidth > innerWidth + 1));
  document.getElementById("out").textContent = L.join("\\n");
},250);
</script>`;
  writeFileSync(join(dir, "caso.html"), html);

  const medir = (ancho) => {
    const dom = execFileSync(chromium, [
      // --no-sandbox porque el build de esta VPS corre como root, y Chrome se niega a arrancar
      // así con el sandbox puesto (crbug.com/638180). No abre ninguna puerta: mide un HTML que
      // este mismo script acaba de escribir en un directorio temporal, sin red y sin contenido
      // ajeno que aislar. Sin la bandera, esto no avisaba: REVENTABA el despliegue.
      "--headless", "--no-sandbox", "--disable-gpu", `--window-size=${ancho},760`,
      "--virtual-time-budget=3000", "--dump-dom", `file://${join(dir, "caso.html")}`,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
    return Object.fromEntries((m ? m[1] : "").trim().split("\n").map((l) => l.split("=")));
  };

  // A 500 porque Chromium sin ventana no baja de ahí; el caso estrecho de verdad (390px) se
  // cubre con el `max-width` del propio popover, que ya está comprobado arriba por CSS.
  for (const ancho of [1400, 500]) {
    const r = medir(ancho);
    comprobar(`Popover dentro de la pantalla a ${ancho}px`, r.POPOVER_DENTRO === "true", r.POPOVER_DENTRO);
    comprobar(`Sin desplazamiento horizontal a ${ancho}px`, r.SCROLL_H === "false", r.SCROLL_H);
  }

  // El control tiene que resolver a los tokens, no a un valor suelto de alguna regla vieja.
  const r = medir(1400);
  comprobar("Campo con el estilo unificado", r.CONTROL === "8px|1px|14px", r.CONTROL);

  // ── La columna de acciones de Gestión de Personal ──────────────────────────
  //
  // Una fila archivada llegó a tener cuatro botones (editar, contraseña, restaurar, borrar) y en
  // un portátil solo se veían dos: la tabla desplazaba en horizontal y los dos últimos quedaban
  // fuera. Se arregló anclando la columna al borde derecho, y esto lo vigila.
  //
  // Se mide con la tabla DESPLAZADA A LA IZQUIERDA (scrollLeft = 0), que es justo donde la
  // columna de acciones se iba de la pantalla. Nombre larguísimo y sin cortes para forzar el
  // desbordamiento sin depender del ancho de ventana que dé Chromium.
  const tablaHtml = `<script>document.documentElement.setAttribute("data-theme","dark")</script>
<link rel="stylesheet" href="app.css">
<div class="mc-card emp-table-card">
  <div class="emp-table-scroll" id="scroll">
    <table class="emp-table">
      <thead><tr>
        <th class="emp-table-th emp-table-th--nombre">Nombre</th>
        <th class="emp-table-th">Usuario</th>
        <th class="emp-table-th emp-table-th--sucursal">Sucursal</th>
        <th class="emp-table-th">Rol</th>
        <th class="emp-table-th">Estado</th>
        <th class="emp-table-th emp-table-th--acciones">Acciones</th>
      </tr></thead>
      <tbody><tr class="emp-table-row emp-table-row--estatica">
        <td style="white-space:nowrap">MARIA CONCEPCION ANDRADE GARCIA DE LOS SANTOS HERNANDEZ</td>
        <td class="emp-table-nowrap">@maria.concepcion.andrade</td>
        <td class="emp-table-nowrap emp-table-th--sucursal">McDental Tampico Obregon</td>
        <td><span class="mc-tag">empleado</span></td>
        <td><span class="mc-tag">Archivado</span></td>
        <td class="emp-table-acciones">
          <div class="emp-table-acciones-grupo">
            <button class="emp-table-icon-btn"></button>
            <button class="emp-table-icon-btn emp-table-icon-btn--amber"></button>
            <button class="emp-table-icon-btn emp-table-icon-btn--ok"></button>
            <button class="emp-table-icon-btn emp-table-icon-btn--danger"></button>
          </div>
        </td>
      </tr></tbody>
    </table>
  </div>
</div>
<pre id="out"></pre>
<script>
setTimeout(function(){
  var L=[], caja=document.getElementById("scroll").getBoundingClientRect();
  var botones=[].slice.call(document.querySelectorAll(".emp-table-icon-btn"));
  var dentro=botones.filter(function(b){
    var r=b.getBoundingClientRect();
    return r.width>0 && r.left>=caja.left-0.5 && r.right<=caja.right+0.5;
  });
  L.push("DESBORDA=" + (document.getElementById("scroll").scrollWidth > caja.width + 1));
  L.push("BOTONES_VISIBLES=" + dentro.length + "/" + botones.length);
  L.push("BOTON_CUADRADO=" + Math.round(botones[3].getBoundingClientRect().width));
  document.getElementById("out").textContent = L.join("\\n");
},250);
</script>`;
  writeFileSync(join(dir, "caso-tabla.html"), tablaHtml);

  const medirTabla = (ancho) => {
    const dom = execFileSync(chromium, [
      "--headless", "--no-sandbox", "--disable-gpu", `--window-size=${ancho},760`,
      "--virtual-time-budget=3000", "--dump-dom", `file://${join(dir, "caso-tabla.html")}`,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
    return Object.fromEntries((m ? m[1] : "").trim().split("\n").map((l) => l.split("=")));
  };

  for (const ancho of [1000, 800]) {
    const t = medirTabla(ancho);
    // Si a este ancho la tabla NO desborda, la comprobación no está midiendo nada: se dice, en
    // vez de dar un verde que no significa lo que parece.
    if (t.DESBORDA !== "true") {
      avisos.push(`La tabla de personal no desborda a ${ancho}px: el anclaje no se pudo medir ahí`);
      continue;
    }
    comprobar(
      `Los 4 botones de acciones visibles a ${ancho}px`,
      t.BOTONES_VISIBLES === "4/4",
      t.BOTONES_VISIBLES
    );
  }
  const t1000 = medirTabla(1000);
  comprobar("Botón de acción sin aplastar", t1000.BOTON_CUADRADO === "30", `${t1000.BOTON_CUADRADO}px`);

  rmSync(dir, { recursive: true, force: true });
}

// ── Resultado ─────────────────────────────────────────────────────────────────
for (const p of pasos) console.log(`  ok    ${p}`);
for (const a of avisos) console.log(`  AVISO ${a}`);
for (const f of fallos) console.error(`  FALLA ${f}`);
console.log(
  `\n${pasos.length} comprobaciones bien, ${fallos.length} mal` +
  (avisos.length ? `, ${avisos.length} sin poder ejecutarse.` : ".")
);
process.exit(fallos.length ? 1 : 0);
