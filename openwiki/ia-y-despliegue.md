# IA, entorno y despliegue — McDental Pulse

## Motor de IA — proxy de Gemini (`api/gemini.js`)

Función serverless (estilo Vercel `handler(req, res)`) que aísla la key de Gemini del
navegador. Reglas que implementa:

1. **Solo `POST`** (405 en otro método).
2. Requiere `GEMINI_API_KEY` y config de Supabase en el servidor (500 si faltan).
3. **Autenticación obligatoria**: exige `Authorization: Bearer <JWT de Supabase>`. Valida
   el token con `supabase.auth.getUser(token)` (401 si falta o es inválido). Sin esto el
   endpoint quedaría público y cualquiera podría quemar la cuota de Gemini.
4. **System prompt fijado en el servidor** (`DEFAULT_SYSTEM`): responde en español, conciso,
   empático, y **nunca diagnostica** (solo sugiere intervenciones). Se ignora cualquier
   `system` enviado por el cliente para que no se pueda saltar ese guardarraíl.
5. Modelo: **`gemini-2.5-flash`**. Errores de la API → 502.

> El cliente Supabase dentro del proxy usa la **anon key** solo para validar el JWT; **no**
> hace bypass de RLS.

### Cómo se sirve en desarrollo

`vite.config.js` incluye un plugin dev-only (`devApiProxy`) que monta `/api/gemini` durante
`npm run dev` reutilizando `api/gemini.js` y cargando `GEMINI_API_KEY` de `.env.local`. Para
un entorno idéntico a producción, usar `vercel dev`.

## Variables de entorno

Copiar `.env.example` → `.env.local`:

| Variable | Ámbito | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | cliente | URL del proyecto Supabase (pública) |
| `VITE_SUPABASE_ANON_KEY` | cliente | Anon key pública (la seguridad la da RLS) |
| `GEMINI_API_KEY` | **servidor** | Key de Gemini. **Sin** prefijo `VITE_` → no entra al bundle |

⚠️ **Nunca** uses `VITE_GEMINI_API_KEY`: el prefijo `VITE_` expone la variable en el bundle
del navegador. En producción, `GEMINI_API_KEY` se configura en Vercel → Environment Variables.

## Scripts npm (`package.json`)

| Script | Acción |
|---|---|
| `dev` | Servidor de desarrollo Vite (+ proxy `/api/gemini`) |
| `build` | Build de producción. `prebuild` genera los iconos PWA |
| `preview` | Sirve el build |
| `lint` | ESLint sobre todo el repo |
| `generate:pwa-icons` | Genera iconos PWA (`scripts/generate-pwa-icons.mjs`, usa `sharp`) |
| `migrate:supabase` | Script histórico de migración Firestore→Supabase |

## PWA

Configurada con `vite-plugin-pwa` (`registerType: 'autoUpdate'`). Manifest en
`vite.config.js`: nombre "McDental Pulse", `theme_color`/`background_color` `#071613`,
`display: standalone`, orientación `portrait-primary`, idioma `es`, iconos 192/512 + maskable.

## Despliegue (Vercel)

- **`vercel.json`**: reescribe todas las rutas a `/index.html` (SPA fallback), necesario para
  que React Router maneje el enrutado en el cliente.
- La función `api/gemini.js` se despliega automáticamente como Serverless Function.
- Variables de entorno (incluida `GEMINI_API_KEY`) se definen en el panel de Vercel.
- Repos de referencia (según `README.md`): producción en
  `McDentalPulse-app/Mcdental-pulse-final` (rama `develop`); backup en
  `MCDentalSist/MCDentalPulseBackUp` (rama `main`).

## Checklist para producción

- [ ] `GEMINI_API_KEY` configurada en Vercel (sin prefijo `VITE_`).
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` configuradas.
- [ ] Migraciones aplicadas en el proyecto Supabase destino (hasta la 26).
- [ ] Buckets `expedientes` (privado) y `avatars` (público) creados con sus políticas.
- [ ] RLS activo en todas las tablas.
