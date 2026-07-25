// CORS acotado a los orígenes de la app.
//
// Antes era `Access-Control-Allow-Origin: *`. El riesgo real era bajo —las tres funciones
// exigen un JWT válido de Supabase, y un sitio ajeno no puede conseguir uno— pero no hay
// motivo para que cualquier origen pueda invocarlas.
//
// La lista se configura con el secreto ALLOWED_ORIGINS (separado por comas), para que añadir
// un dominio propio no obligue a tocar código:
//
//   supabase secrets set ALLOWED_ORIGINS="https://pulse.mcdental.mx,https://mcdental-pulse-final.vercel.app"
//
// Si no está definido, se permite el dominio de Vercel del proyecto, sus previews
// (*.vercel.app) y localhost para desarrollo.

const ORIGENES_POR_DEFECTO = [
  "https://mcdental-pulse-final.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const configurados = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const PERMITIDOS = configurados.length ? configurados : ORIGENES_POR_DEFECTO;

// Cada preview de Vercel usa un subdominio distinto, así que no se pueden enumerar: se
// aceptan por patrón, y SOLO mientras no se haya configurado ALLOWED_ORIGINS a mano.
const esPreviewDeVercel = (origen: string) =>
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origen);

const esPermitido = (origen: string) =>
  PERMITIDOS.includes(origen) || (configurados.length === 0 && esPreviewDeVercel(origen));

const CABECERAS_BASE: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // Sin esto, una caché intermedia podría servirle a un origen la respuesta de otro.
  Vary: "Origin",
};

/**
 * Cabeceras CORS para una petición concreta.
 *
 * Si el origen no está permitido NO se emite Access-Control-Allow-Origin, y el navegador
 * bloquea la respuesta. La petición en sí sigue exigiendo un JWT válido: esto es una capa
 * más, no la única.
 */
export const corsFor = (req: Request): Record<string, string> => {
  const origen = req.headers.get("Origin") ?? "";
  if (!origen || !esPermitido(origen)) return { ...CABECERAS_BASE };
  return { ...CABECERAS_BASE, "Access-Control-Allow-Origin": origen };
};
