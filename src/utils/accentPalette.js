// ═══════════════════════════════════════════════════════════════════════════
// Paleta de marca personalizable
// ═══════════════════════════════════════════════════════════════════════════
// La app entera se colorea desde una familia teal (ver src/index.css). Aquí, a
// partir de UNA semilla hex, generamos toda esa familia por ROTACIÓN DE TONO EN
// OKLCH: cada color de marca conserva su LUMINOSIDAD PERCEPTUAL (L) y su croma
// (C) originales y solo cambia de tono (H).
//
// ¿Por qué OKLCH y no HSL? La L de HSL no es brillo perceptual: dos colores con
// la misma L de HSL se ven con brillos muy distintos según el tono (un amarillo
// "al 30%" se ve mucho más claro que un teal "al 30%"). Rotar en HSL rompía el
// contraste AA al girar hacia amarillos/limas. La L de OKLCH sí es perceptual:
// preservarla mantiene el contraste casi constante en todo el espectro, así el
// AA que ya está cuidado en index.css sobrevive la rotación intacto.
//
// El resultado es un objeto { "--variable": "valor" } que AccentContext aplica
// inline sobre <html>. Incluye:
//   · los 9 tonos brand-* y sus gemelos --color-brand-* (utilidades Tailwind),
//   · aqua / verde* / marca-texto,
//   · los canales RGB que consumen los ~156 rgba() literales del CSS,
//   · los tres gradientes de marca regenerados desde la escala nueva.

// Semilla de la marca actual (teal McDental). Es el punto de referencia: una
// paleta con esta semilla debe reproducir EXACTAMENTE los valores de index.css.
export const SEMILLA_TEAL = "#0E8C7A";

// Presets curados. Son semillas; la escala se genera igual para todas, así que
// solo hay un camino de código. La primera es el default.
export const PRESETS = [
  { id: "teal", nombre: "Teal", hex: SEMILLA_TEAL },
  { id: "esmeralda", nombre: "Esmeralda", hex: "#10B981" },
  { id: "azul", nombre: "Azul", hex: "#2563EB" },
  { id: "indigo", nombre: "Índigo", hex: "#6366F1" },
  { id: "violeta", nombre: "Violeta", hex: "#7C3AED" },
  { id: "rosa", nombre: "Rosa", hex: "#DB2777" },
  { id: "ambar", nombre: "Ámbar", hex: "#D97706" },
];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// ── Utilidades hex ↔ RGB. ─────────────────────────────────────────────────────
const hexARgb = (hex) => {
  const s = String(hex).replace("#", "").trim();
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
};

const rgbAHexStr = ({ r, g, b }) =>
  "#" + [r, g, b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, "0")).join("");

// ── Conversión sRGB ↔ OKLCH (OKLab de Björn Ottosson, sin dependencias). ──────
const srgbALineal = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const linealACanal255 = (v) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(clamp(c, 0, 1) * 255);
};

// hex → { L, C, H }. L y C normalizados (0..1 aprox), H en grados 0..360.
export const hexAOklch = (hex) => {
  const { r, g, b } = hexARgb(hex);
  const lr = srgbALineal(r);
  const lg = srgbALineal(g);
  const lb = srgbALineal(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
};

// { L, C, H } → { r, g, b } lineal (aún sin recortar a gama).
const oklchALinealRgb = ({ L, C, H }) => {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return {
    lr: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    lg: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    lb: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
};

const enGama = ({ lr, lg, lb }) => {
  const eps = 1e-4;
  return (
    lr >= -eps && lr <= 1 + eps &&
    lg >= -eps && lg <= 1 + eps &&
    lb >= -eps && lb <= 1 + eps
  );
};

// { L, C, H } → { r, g, b } 0..255. Si el color se sale de sRGB (croma
// inalcanzable a esa L y ese H), reduce SOLO el croma por bisección conservando
// L y H — así el tono elegido no se distorsiona al recortar (mejor que clavar
// los canales RGB, que desplaza tono y luminosidad).
const oklchARgb = (oklch) => {
  let lineal = oklchALinealRgb(oklch);
  if (!enGama(lineal)) {
    let lo = 0;
    let hi = oklch.C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const probe = oklchALinealRgb({ ...oklch, C: mid });
      if (enGama(probe)) {
        lo = mid;
        lineal = probe;
      } else {
        hi = mid;
      }
    }
  }
  return {
    r: linealACanal255(lineal.lr),
    g: linealACanal255(lineal.lg),
    b: linealACanal255(lineal.lb),
  };
};

// Rota un hex por deltaH grados en OKLCH conservando L y C. Devuelve { hex,r,g,b }.
// deltaH === 0 (misma semilla) → identidad exacta: devuelve el hex original sin
// pasar por la conversión, garantizando que la paleta teal por defecto reproduce
// EXACTAMENTE los valores de index.css (el round-trip OKLCH no es 100% lossless).
const rotar = (hex, deltaH) => {
  if (deltaH === 0) return { hex, ...hexARgb(hex) };
  const { L, C, H } = hexAOklch(hex);
  const rgb = oklchARgb({ L, C, H: (((H + deltaH) % 360) + 360) % 360 });
  return { hex: rgbAHexStr(rgb), ...rgb };
};

// Valores de marca de la app HOY (transcritos de src/index.css). Sobre estos se
// aplica la rotación. Si algún día cambian en index.css, cambian aquí también.
const MARCA_BASE = {
  "brand-950": "#06201D",
  "brand-900": "#0A332E",
  "brand-800": "#0C463E",
  "brand-700": "#0E5A4F",
  "brand-600": "#107463",
  "brand-500": "#0E8C7A",
  "brand-400": "#19B6A2",
  "brand-300": "#46D6C5",
  "brand-200": "#8AE9DD",
  aqua: "#14C8B6",
  verde: "#0E8C7A",
  "verde-oscuro": "#0A3B36",
  "verde-medio": "#0E8C7A",
  "verde-claro": "#E6F7F4",
  "marca-texto": "#0B7A6B",
};

const rgbCanal = ({ r, g, b }) => `${r} ${g} ${b}`;

/**
 * Genera toda la familia de marca a partir de una semilla hex.
 * Hex inválido → cae a la semilla teal (paleta por defecto).
 * @returns {Record<string,string>} mapa { "--variable": "valor" } para setProperty.
 */
export const generarPaleta = (semilla) => {
  const valido = /^#[0-9A-Fa-f]{6}$/.test(String(semilla || "").trim());
  const hex = valido ? semilla.trim() : SEMILLA_TEAL;

  // Cuánto rotar el tono, medido en OKLCH: diferencia de tono entre la semilla
  // elegida y el teal de referencia.
  const deltaH = hexAOklch(hex).H - hexAOklch(SEMILLA_TEAL).H;

  // Rota cada valor base.
  const c = {};
  for (const [nombre, valor] of Object.entries(MARCA_BASE)) {
    c[nombre] = rotar(valor, deltaH);
  }

  const grad = (deg, ...stops) => `linear-gradient(${deg}, ${stops.join(", ")})`;

  return {
    // Escala primitiva (usada por glass, gradientes y :root).
    "--brand-950": c["brand-950"].hex,
    "--brand-900": c["brand-900"].hex,
    "--brand-800": c["brand-800"].hex,
    "--brand-700": c["brand-700"].hex,
    "--brand-600": c["brand-600"].hex,
    "--brand-500": c["brand-500"].hex,
    "--brand-400": c["brand-400"].hex,
    "--brand-300": c["brand-300"].hex,
    "--brand-200": c["brand-200"].hex,

    // Gemelos --color-brand-* que consumen las utilidades Tailwind (bg-brand-500…).
    "--color-brand-950": c["brand-950"].hex,
    "--color-brand-900": c["brand-900"].hex,
    "--color-brand-800": c["brand-800"].hex,
    "--color-brand-700": c["brand-700"].hex,
    "--color-brand-600": c["brand-600"].hex,
    "--color-brand-500": c["brand-500"].hex,
    "--color-brand-400": c["brand-400"].hex,
    "--color-brand-300": c["brand-300"].hex,
    "--color-brand-200": c["brand-200"].hex,
    "--color-aqua": c.aqua.hex,

    // Acentos semánticos de marca.
    "--mc-aqua": c.aqua.hex,
    "--mc-verde": c.verde.hex,
    "--mc-verde-oscuro": c["verde-oscuro"].hex,
    "--mc-verde-medio": c["verde-medio"].hex,
    "--mc-verde-claro": c["verde-claro"].hex,
    "--mc-marca-texto": c["marca-texto"].hex,

    // Rotación de tono en grados (OKLCH) que aplican las superficies/fondos
    // oscuros: se escriben como oklch(L C calc(<tono-teal> + var(--mc-brand-dh)))
    // y así rotan por el MISMO delta que los swatches, conservando su L y su C.
    // Con la semilla teal el delta es 0 → cada superficie reproduce su teal
    // exacto (el round-trip oklch de esos literales es lossless, verificado).
    "--mc-brand-dh": deltaH.toFixed(2),

    // Canales RGB para los rgba() literales del CSS (space-separated: "R G B").
    "--mc-aqua-rgb": rgbCanal(c.aqua),
    "--mc-verde-rgb": rgbCanal(c.verde),
    // Ojo: el canal --mc-verde-oscuro-rgb es #006D5B (el verde primario viejo que
    // usan los literales rgba del CSS), distinto de la variable --mc-verde-oscuro
    // (#0A3B36). Se rota su color exacto, no la variable semántica.
    "--mc-verde-oscuro-rgb": rgbCanal(rotar("#006D5B", deltaH)),
    "--mc-brand600-rgb": rgbCanal(c["brand-600"]),
    "--mc-brand300-rgb": rgbCanal(c["brand-300"]),
    "--mc-brand200-rgb": rgbCanal(c["brand-200"]),

    // Gradientes de marca regenerados desde la escala nueva (mismos ángulos y
    // stops que index.css, ver --grad-brand / --grad-brand-soft / --grad-accent).
    "--grad-brand": grad("150deg", `${c["brand-900"].hex} 0%`, `${c["brand-700"].hex} 45%`, `${c["brand-600"].hex} 100%`),
    "--grad-brand-soft": grad("160deg", `${c["brand-800"].hex} 0%`, `${c["brand-500"].hex} 100%`),
    // El extremo oscuro de --grad-accent es un teal un paso más claro (#10A090)
    // para pasar AA con el texto encima; lo rotamos igual que el resto.
    "--grad-accent": grad("135deg", `${c.aqua.hex} 0%`, `${rotar("#10A090", deltaH).hex} 100%`),
  };
};
