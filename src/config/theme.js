/**
 * Puente entre el dominio (un "nivel" de semáforo) y el color.
 *
 * Aquí NO hay ni un hex, a propósito. Antes sí los había —`semaforoColor`, `semaforoBg` y
 * el objeto `UI`— y ese era el motivo real de que el modo oscuro no funcionara: un color
 * en JavaScript acaba en un `style={{ color: "#22c55e" }}`, que gana por especificidad y
 * ninguna regla CSS de tema oscuro puede pisar.
 *
 * Dos cosas que se descubrieron al quitarlos:
 *
 * 1. Había TRES paletas para el mismo semáforo: index.css decía que el verde era #059669,
 *    pulseScore.js que #22c55e y este archivo que #2F7D5A. El que se veía dependía de por
 *    qué componente se renderizara.
 *
 * 2. El objeto `UI` estaba OBSOLETO: decía que el verde de marca era #00796B y la fuente
 *    'Inter', cuando la marca real es #0E8C7A y la fuente es Fira Sans. Solo lo usaba
 *    KPI.jsx, así que los KPIs llevaban tiempo pintándose con un verde que ya no existía.
 *
 * Ahora estas funciones devuelven una **variable CSS**, no un color. La resuelve el
 * navegador según el tema activo, así que el mismo `nivel` se pinta claro u oscuro sin que
 * el componente tenga que saber nada del tema.
 *
 * Ver DESIGN.md.
 */

const VAR_POR_NIVEL = {
  verde: "var(--mc-semaforo-verde)",
  amarillo: "var(--mc-semaforo-amarillo)",
  rojo: "var(--mc-semaforo-rojo)",
  "sin-datos": "var(--mc-texto-secundario)",
};

/** Color de un nivel de semáforo, como variable CSS. Cambia con el tema. */
export const nivelColor = (nivel) => VAR_POR_NIVEL[nivel] || VAR_POR_NIVEL["sin-datos"];

/**
 * El color del nivel mezclado con transparencia — para tintes y fondos suaves.
 *
 * Sustituye al viejo `${color}14`, que concatenaba el alpha al final de un hex y por eso
 * SOLO funcionaba con hex: con una variable CSS no hay nada que concatenar. `color-mix()`
 * sí acepta variables, así que el tinte también reacciona al tema.
 */
export const nivelTinte = (nivel, porcentaje = 8) =>
  `color-mix(in srgb, ${nivelColor(nivel)} ${porcentaje}%, transparent)`;

/**
 * Fondo y texto de un badge/pill de semáforo.
 *
 * Sustituye a `status.bg` (que devolvía #dcfce7 y compañía). En claro son los pasteles de
 * siempre; en oscuro, fondos saturados con texto claro — que es lo que ya definía
 * index.css pero solo llegaba a algunas pantallas.
 */
export const nivelBadgeBg = (nivel) =>
  nivel === "verde" || nivel === "amarillo" || nivel === "rojo"
    ? `var(--mc-badge-${nivel}-bg)`
    : "var(--mc-gris-perla)";

export const nivelBadgeFg = (nivel) =>
  nivel === "verde" || nivel === "amarillo" || nivel === "rojo"
    ? `var(--mc-badge-${nivel}-texto)`
    : "var(--mc-texto-secundario)";

/** Color de marca (acción primaria), como variable CSS. Sustituye a `UI.verdeMedio`. */
export const colorMarca = "var(--mc-verde)";

/** Tinte del color de marca. Sustituye a los `color-mix(... ${UI.verdeMedio} ...)`. */
export const tinteMarca = (porcentaje = 8) =>
  `color-mix(in srgb, ${colorMarca} ${porcentaje}%, transparent)`;

/** Etiqueta legible de cada nivel. Es texto, no color: se queda. */
export const semaforoLabel = {
  verde: "Estable",
  amarillo: "Atención",
  rojo: "Foco Rojo",
};

const SERIES = 8;

/**
 * Color de una serie de la gráfica de tendencia por sucursal, como variable CSS.
 *
 * No es el semáforo: aquí el color solo distingue una serie de otra, no significa nada.
 * Antes era el array `TREND_COLORS`, duplicado literalmente en AdminDashboard y en
 * PsicologaDashboard.
 */
export const colorSerie = (i) => `var(--mc-serie-${(i % SERIES) + 1})`;

/**
 * Metadatos de un nivel de semáforo: etiqueta + color.
 *
 * Sustituye a `SEMAFORO_META`, que era otra copia local de la paleta (con su propio
 * #22c55e) repetida en los dos dashboards.
 */
export const NIVELES = ["verde", "amarillo", "rojo", "sin-datos"];

export const nivelMeta = (nivel) => ({
  label: semaforoLabel[nivel] ?? "Sin datos",
  color: nivelColor(nivel),
});
